import json
import logging

from pydantic import ValidationError

from app.worker.config import load_worker_settings
from app.worker.fastapi_client import FastApiClient
from app.worker.http_client import JsonHttpClient
from app.worker.http_client import JsonHttpClientError
from app.worker.processor import ScanTaskProcessor
from app.worker.schemas import ScanRequestMessage
from app.worker.spring_client import SpringClient


logger = logging.getLogger(__name__)

NON_REQUEUE_HTTP_STATUS_CODES = {400, 401, 403, 404, 409}


def should_requeue_exception(exc: Exception) -> bool:
    if isinstance(exc, JsonHttpClientError):
        if exc.status_code in NON_REQUEUE_HTTP_STATUS_CODES:
            return False
        return True
    return True


def build_processor() -> ScanTaskProcessor:
    settings = load_worker_settings()
    spring_headers: dict[str, str] = {}
    if settings.spring_api_secret is not None:
        spring_headers["X-Worker-Secret"] = settings.spring_api_secret

    spring_client = SpringClient(
        JsonHttpClient(
            base_url=settings.spring_base_url,
            timeout_seconds=settings.http_timeout_seconds,
            default_headers=spring_headers,
            max_retries=settings.http_max_retries,
            retry_backoff_seconds=settings.http_retry_backoff_seconds,
            retry_backoff_max_seconds=settings.http_retry_backoff_max_seconds,
        )
    )
    fastapi_client = FastApiClient(
        JsonHttpClient(
            base_url=settings.fastapi_base_url,
            timeout_seconds=settings.http_timeout_seconds,
            max_retries=settings.http_max_retries,
            retry_backoff_seconds=settings.http_retry_backoff_seconds,
            retry_backoff_max_seconds=settings.http_retry_backoff_max_seconds,
        )
    )
    return ScanTaskProcessor(
        spring_client=spring_client,
        fastapi_client=fastapi_client,
        settings=settings,
    )


def run() -> None:
    logging.basicConfig(level=logging.INFO)

    try:
        import pika
    except ImportError as exc:
        raise RuntimeError(
            "pika is required to run the RabbitMQ worker. "
            "Install AI/requirements.txt first."
        ) from exc

    settings = load_worker_settings()
    processor = build_processor()
    credentials = pika.PlainCredentials(
        settings.rabbitmq_username,
        settings.rabbitmq_password,
    )
    parameters = pika.ConnectionParameters(
        host=settings.rabbitmq_host,
        port=settings.rabbitmq_port,
        virtual_host=settings.rabbitmq_virtual_host,
        credentials=credentials,
    )

    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    channel.basic_qos(prefetch_count=1)

    def on_message(channel, method, properties, body: bytes) -> None:
        del properties

        try:
            payload = json.loads(body.decode("utf-8"))
            message = ScanRequestMessage.model_validate(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError, ValueError):
            logger.exception("Invalid RabbitMQ scan request message.")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        attempts = processor.redelivery_tracker.record(message.task_id)
        if attempts > processor.redelivery_tracker.cap:
            logger.warning(
                "Redelivery cap exceeded. taskId=%s scanId=%s attempts=%d cap=%d",
                message.task_id,
                message.scan_id,
                attempts,
                processor.redelivery_tracker.cap,
            )
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return

        try:
            logger.info(
                "Processing scan task taskId=%s scanId=%s rawResultPath=%s",
                message.task_id,
                message.scan_id,
                message.raw_result_path,
            )
            processor.process(message)
        except Exception as exc:
            requeue = should_requeue_exception(exc)
            logger.exception(
                "Unhandled scan task failure taskId=%s scanId=%s requeue=%s",
                message.task_id,
                message.scan_id,
                requeue,
            )
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=requeue)
            return

        channel.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_consume(
        queue=settings.scan_request_queue,
        on_message_callback=on_message,
    )
    logger.info("Waiting for scan tasks from queue=%s", settings.scan_request_queue)
    channel.start_consuming()


if __name__ == "__main__":
    run()
