import asyncio
import json
import logging
import signal
import sys
from typing import TYPE_CHECKING

from pydantic import ValidationError

from app.core.logging_utils import log_with_fields
from app.worker.bootstrap import build_processor, should_requeue_exception
from app.worker.config import load_worker_settings
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
        ) as exc:
            log_with_fields(
                logger,
                logging.ERROR,
                "Invalid RabbitMQ scan request message.",
                deliveryTag=message.delivery_tag,
                redelivered=message.redelivered,
                errorClass=type(exc).__name__,
                stage="MESSAGE_CONSUMED",
                status="REJECTED",
                exc_info=True,
            )
            await message.nack(requeue=False)
            return

        attempts = processor.redelivery_tracker.record(scan_msg.task_id)
        if attempts > processor.redelivery_tracker.cap:
            log_with_fields(
                logger,
                logging.WARNING,
                "Redelivery cap exceeded.",
                scanId=scan_msg.scan_id,
                taskId=scan_msg.task_id,
                redeliveryCount=attempts,
                cap=processor.redelivery_tracker.cap,
                deliveryTag=message.delivery_tag,
                stage="MESSAGE_DROPPED",
                status="DROPPED",
            )
            try:
                await message.nack(requeue=False)
            except Exception:
                log_with_fields(
                    logger,
                    logging.ERROR,
                    "Failed to nack message after redelivery cap.",
                    scanId=scan_msg.scan_id,
                    taskId=scan_msg.task_id,
                    deliveryTag=message.delivery_tag,
                    stage="NACK_FAILED",
                    status="ERROR",
                    exc_info=True,
                )
            return

        try:
            log_with_fields(
                logger,
                logging.INFO,
                "Processing scan task.",
                scanId=scan_msg.scan_id,
                taskId=scan_msg.task_id,
                rawResultPath=scan_msg.raw_result_path,
                deliveryTag=message.delivery_tag,
                redelivered=message.redelivered,
                redeliveryCount=attempts,
                stage="MESSAGE_CONSUMED",
                status="PROCESSING",
            )
            await asyncio.to_thread(processor.process, scan_msg)
        except Exception as exc:
            requeue = should_requeue_exception(exc)
            log_with_fields(
                logger,
                logging.ERROR,
                "Unhandled scan task failure.",
                scanId=scan_msg.scan_id,
                taskId=scan_msg.task_id,
                errorClass=type(exc).__name__,
                statusCode=getattr(exc, "status_code", None),
                requeue=requeue,
                redeliveryCount=processor.redelivery_tracker.current(
                    scan_msg.task_id
                ),
                deliveryTag=message.delivery_tag,
                stage="TASK_FAILED",
                status="FAILED",
                exc_info=True,
            )
            try:
                await message.nack(requeue=requeue)
            except Exception:
                log_with_fields(
                    logger,
                    logging.ERROR,
                    "Failed to nack message after processing error.",
                    scanId=scan_msg.scan_id,
                    taskId=scan_msg.task_id,
                    deliveryTag=message.delivery_tag,
                    stage="NACK_FAILED",
                    status="ERROR",
                    exc_info=True,
                )
            return

        try:
            await message.ack()
        except Exception:
            log_with_fields(
                logger,
                logging.ERROR,
                "Failed to ack message after successful processing.",
                scanId=scan_msg.scan_id,
                taskId=scan_msg.task_id,
                deliveryTag=message.delivery_tag,
                stage="ACK_FAILED",
                status="ERROR",
                exc_info=True,
            )


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
