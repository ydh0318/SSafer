"""RabbitMQ 부하테스트 메시지 발행기.

사용법:
    python -m scripts.loadtest.publisher --count 10 --findings-per-msg 5
    python -m scripts.loadtest.publisher --count 50 --findings-per-msg 10 --host rabbitmq.example.com
"""

import argparse
import json
import time
from datetime import datetime, timezone

import pika


def build_scan_request_message(
    *,
    task_id: int,
    scan_id: int,
    finding_count: int,
    raw_result_path: str | None = None,
) -> dict:
    return {
        "messageType": "SCAN_REQUEST",
        "messageVersion": 2,
        "taskType": "SCAN_REQUEST",
        "taskId": task_id,
        "agentId": 1,
        "projectId": 1,
        "scanId": scan_id,
        "scanType": "PROJECT_FILE",
        "rawResultPath": raw_result_path
        or f"s3://loadtest-bucket/raw/{scan_id}/scan_result.json",
        "resultCount": finding_count,
        "tool": "loadtest",
        "toolVersion": "1.0.0",
        "payloadHash": f"loadtest-{scan_id}",
        "queuedAt": datetime.now(timezone.utc).isoformat(),
    }


def publish_messages(
    *,
    host: str = "localhost",
    port: int = 5672,
    username: str = "guest",
    password: str = "guest",
    virtual_host: str = "/",
    exchange: str = "ssafer.agent.tasks",
    routing_key: str = "agent.scan.request",
    queue: str = "ssafer.agent.scan.request",
    count: int = 10,
    findings_per_msg: int = 5,
    scan_id_start: int = 90000,
) -> list[dict]:
    credentials = pika.PlainCredentials(username, password)
    parameters = pika.ConnectionParameters(
        host=host,
        port=port,
        virtual_host=virtual_host,
        credentials=credentials,
    )

    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()

    channel.exchange_declare(exchange=exchange, exchange_type="direct", durable=True)
    channel.queue_declare(queue=queue, durable=True)
    channel.queue_bind(queue=queue, exchange=exchange, routing_key=routing_key)

    published = []
    publish_start = time.monotonic()

    for i in range(count):
        task_id = scan_id_start + i
        scan_id = scan_id_start + i
        message = build_scan_request_message(
            task_id=task_id,
            scan_id=scan_id,
            finding_count=findings_per_msg,
        )
        body = json.dumps(message).encode("utf-8")
        channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type="application/json",
            ),
        )
        published.append(message)

    publish_duration = time.monotonic() - publish_start
    connection.close()

    print(f"Published {count} messages in {publish_duration:.2f}s")
    print(f"  Queue: {queue}")
    print(f"  Scan IDs: {scan_id_start} - {scan_id_start + count - 1}")
    print(f"  Findings per message: {findings_per_msg}")

    return published


def main() -> None:
    parser = argparse.ArgumentParser(description="Loadtest message publisher")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5672)
    parser.add_argument("--username", default="guest")
    parser.add_argument("--password", default="guest")
    parser.add_argument("--virtual-host", default="/")
    parser.add_argument("--queue", default="ssafer.agent.scan.request")
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--findings-per-msg", type=int, default=5)
    parser.add_argument("--scan-id-start", type=int, default=90000)
    args = parser.parse_args()

    publish_messages(
        host=args.host,
        port=args.port,
        username=args.username,
        password=args.password,
        virtual_host=args.virtual_host,
        queue=args.queue,
        count=args.count,
        findings_per_msg=args.findings_per_msg,
        scan_id_start=args.scan_id_start,
    )


if __name__ == "__main__":
    main()
