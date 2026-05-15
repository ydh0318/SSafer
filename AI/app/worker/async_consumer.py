import asyncio
import json
import logging
import signal
import sys
from typing import TYPE_CHECKING

from pydantic import ValidationError

from app.worker.config import load_worker_settings
from app.worker.consumer import build_processor, should_requeue_exception
from app.worker.schemas import ScanRequestMessage

if TYPE_CHECKING:
    import aio_pika


logger = logging.getLogger(__name__)


async def process_message(
    message: "aio_pika.IncomingMessage",
    *,
    processor,
    semaphore: asyncio.Semaphore,
) -> None:
    async with semaphore:
        try:
            payload = json.loads(message.body.decode("utf-8"))
            scan_msg = ScanRequestMessage.model_validate(payload)
        except (
            UnicodeDecodeError,
            json.JSONDecodeError,
            ValidationError,
            ValueError,
        ):
            logger.exception("Invalid RabbitMQ scan request message.")
            await message.nack(requeue=False)
            return

        try:
            logger.info(
                "Processing scan task taskId=%s scanId=%s rawResultPath=%s deliveryTag=%s redelivered=%s",
                scan_msg.task_id,
                scan_msg.scan_id,
                scan_msg.raw_result_path,
                message.delivery_tag,
                message.redelivered,
            )
            await asyncio.to_thread(processor.process, scan_msg)
        except Exception as exc:
            requeue = should_requeue_exception(exc)
            logger.exception(
                "Unhandled scan task failure taskId=%s scanId=%s requeue=%s",
                scan_msg.task_id,
                scan_msg.scan_id,
                requeue,
            )
            try:
                await message.nack(requeue=requeue)
            except Exception:
                logger.exception("Failed to nack message after processing error.")
            return

        try:
            await message.ack()
        except Exception:
            logger.exception("Failed to ack message after successful processing.")


async def run_async() -> None:
    import aio_pika

    logging.basicConfig(level=logging.INFO)

    settings = load_worker_settings()
    processor = build_processor()

    max_concurrency = settings.max_concurrency
    semaphore = asyncio.Semaphore(max_concurrency)
    pending_tasks: set[asyncio.Task] = set()
    shutdown_event = asyncio.Event()

    connection = await aio_pika.connect_robust(
        host=settings.rabbitmq_host,
        port=settings.rabbitmq_port,
        login=settings.rabbitmq_username,
        password=settings.rabbitmq_password,
        virtualhost=settings.rabbitmq_virtual_host,
        heartbeat=60,
        timeout=30,
    )

    channel = await connection.channel()
    await channel.set_qos(prefetch_count=max_concurrency)

    queue = await channel.get_queue(settings.scan_request_queue, ensure=False)

    async def on_message(message: aio_pika.IncomingMessage) -> None:
        task = asyncio.create_task(
            process_message(
                message,
                processor=processor,
                semaphore=semaphore,
            )
        )
        pending_tasks.add(task)
        task.add_done_callback(pending_tasks.discard)

    consumer_tag = await queue.consume(on_message)

    if sys.platform != "win32":
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, shutdown_event.set)
    else:
        signal.signal(signal.SIGINT, lambda *_: shutdown_event.set())

    logger.info(
        "Async worker started. queue=%s max_concurrency=%d",
        settings.scan_request_queue,
        max_concurrency,
    )
    await shutdown_event.wait()

    logger.info("Shutdown signal received. Stopping consumer...")
    await queue.cancel(consumer_tag)

    if pending_tasks:
        logger.info("Waiting for %d in-flight tasks...", len(pending_tasks))
        done, timed_out = await asyncio.wait(
            pending_tasks,
            timeout=settings.shutdown_timeout_seconds,
        )
        if timed_out:
            logger.warning(
                "%d tasks did not complete before shutdown timeout.",
                len(timed_out),
            )
            for t in timed_out:
                t.cancel()

    await connection.close()
    logger.info("Async worker stopped.")


def run() -> None:
    asyncio.run(run_async())


if __name__ == "__main__":
    run()
