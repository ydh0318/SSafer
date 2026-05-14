"""부하테스트 오케스트레이터.

사전 조건:
    1. RabbitMQ 실행 중
    2. Mock FastAPI 실행: uvicorn scripts.loadtest.mock_fastapi:app --port 8000
    3. Mock Spring 실행: uvicorn scripts.loadtest.mock_spring:app --port 8080
    4. Worker 실행: python -m app.worker.async_consumer (또는 app.worker.consumer)

사용법:
    python -m scripts.loadtest.run_loadtest --scenario S1
    python -m scripts.loadtest.run_loadtest --scenario S3 --mock-fastapi-url http://localhost:8000
"""

import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request

from scripts.loadtest.publisher import publish_messages


SCENARIOS = {
    "S1": {
        "name": "Baseline (순차)",
        "count": 10,
        "findings_per_msg": 5,
        "description": "현재 구조 성능 측정 (max_concurrency=1, max_llm_concurrency=1)",
    },
    "S2": {
        "name": "메시지 병렬만",
        "count": 10,
        "findings_per_msg": 5,
        "description": "메시지 레벨 효과 측정 (max_concurrency=5)",
    },
    "S3": {
        "name": "병렬의 병렬",
        "count": 10,
        "findings_per_msg": 5,
        "description": "최종 구조 성능 측정 (max_concurrency=5, max_llm_concurrency=10)",
    },
    "S4": {
        "name": "Stress",
        "count": 50,
        "findings_per_msg": 10,
        "description": "대량 부하 안정성 (max_concurrency=10, max_llm_concurrency=20)",
    },
    "S5-1": {
        "name": "실제 API Smoke",
        "count": 5,
        "findings_per_msg": 3,
        "description": "실제 API 연결/응답/callback 확인",
    },
    "S5-2": {
        "name": "실제 API Small",
        "count": 10,
        "findings_per_msg": 5,
        "description": "소규모 병렬 처리 안정성 확인",
    },
    "S5-3": {
        "name": "실제 API Target",
        "count": 20,
        "findings_per_msg": 5,
        "description": "목표 부하에서 rate limit 확인",
    },
}


def http_get_json(url: str, timeout: int = 10) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"  [ERROR] Failed to reach {url}: {exc}")
        return {}


def http_post_json(url: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, data=b"{}", method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"  [ERROR] Failed to reach {url}: {exc}")
        return {}


def check_services(
    mock_fastapi_url: str,
    mock_spring_url: str,
    rabbitmq_host: str,
    rabbitmq_port: int,
) -> bool:
    print("Checking services...")
    ok = True

    fastapi_health = http_get_json(f"{mock_fastapi_url}/health")
    if fastapi_health.get("status") == "ok":
        print(f"  Mock FastAPI: OK ({mock_fastapi_url})")
    else:
        print(f"  Mock FastAPI: UNREACHABLE ({mock_fastapi_url})")
        ok = False

    spring_health = http_get_json(f"{mock_spring_url}/health")
    if spring_health.get("status") == "ok":
        print(f"  Mock Spring: OK ({mock_spring_url})")
    else:
        print(f"  Mock Spring: UNREACHABLE ({mock_spring_url})")
        ok = False

    try:
        import pika

        conn = pika.BlockingConnection(
            pika.ConnectionParameters(host=rabbitmq_host, port=rabbitmq_port)
        )
        conn.close()
        print(f"  RabbitMQ: OK ({rabbitmq_host}:{rabbitmq_port})")
    except Exception as exc:
        print(f"  RabbitMQ: UNREACHABLE ({rabbitmq_host}:{rabbitmq_port}) — {exc}")
        ok = False

    return ok


def wait_for_completion(
    mock_spring_url: str,
    expected_done: int,
    timeout: int = 600,
    poll_interval: float = 2.0,
) -> dict:
    print(f"\nWaiting for {expected_done} DONE callbacks (timeout {timeout}s)...")
    start = time.monotonic()

    while time.monotonic() - start < timeout:
        summary = http_get_json(f"{mock_spring_url}/callbacks/summary")
        done = summary.get("done_count", 0)
        failed = summary.get("failed_count", 0)
        total = done + failed

        elapsed = time.monotonic() - start
        print(
            f"  [{elapsed:.0f}s] done={done} failed={failed} total={total}/{expected_done}",
            end="\r",
        )

        if total >= expected_done:
            print()
            return summary

        time.sleep(poll_interval)

    print(f"\n  [TIMEOUT] Only {done + failed}/{expected_done} completed in {timeout}s")
    return http_get_json(f"{mock_spring_url}/callbacks/summary")


def collect_metrics(mock_spring_url: str, mock_fastapi_url: str) -> dict:
    callbacks_data = http_get_json(f"{mock_spring_url}/callbacks")
    fastapi_stats = http_get_json(f"{mock_fastapi_url}/stats")

    callbacks = callbacks_data.get("callbacks", [])
    done_callbacks = [c for c in callbacks if c.get("status") == "DONE"]
    failed_callbacks = [c for c in callbacks if c.get("status") == "FAILED"]
    running_callbacks = [c for c in callbacks if c.get("status") == "RUNNING"]

    latencies = []
    for running in running_callbacks:
        scan_id = running["scan_id"]
        matching_done = [c for c in done_callbacks if c["scan_id"] == scan_id]
        if matching_done:
            start_t = running["received_monotonic"]
            end_t = matching_done[0]["received_monotonic"]
            latencies.append(end_t - start_t)

    return {
        "total_callbacks": len(callbacks),
        "done": len(done_callbacks),
        "failed": len(failed_callbacks),
        "running": len(running_callbacks),
        "elapsed_seconds": callbacks_data.get("elapsed_seconds", 0),
        "fastapi_stats": fastapi_stats,
        "latencies": latencies,
    }


def print_results(scenario_name: str, metrics: dict, msg_count: int) -> None:
    elapsed = metrics["elapsed_seconds"]
    done = metrics["done"]
    failed = metrics["failed"]
    latencies = metrics["latencies"]

    throughput = (done / elapsed * 60) if elapsed > 0 else 0

    print(f"\n{'=' * 50}")
    print(f"  Load Test Results: {scenario_name}")
    print(f"{'=' * 50}")
    print(f"  Messages:     {msg_count} published, {done} done, {failed} failed")
    print(f"  Duration:     {elapsed:.1f}s")
    print(f"  Throughput:   {throughput:.1f} msg/min")
    print(f"  Error rate:   {failed / max(done + failed, 1) * 100:.1f}%")

    if latencies:
        latencies_sorted = sorted(latencies)
        p50_idx = int(len(latencies_sorted) * 0.50)
        p95_idx = min(int(len(latencies_sorted) * 0.95), len(latencies_sorted) - 1)
        p99_idx = min(int(len(latencies_sorted) * 0.99), len(latencies_sorted) - 1)

        print(f"  Latency P50:  {latencies_sorted[p50_idx]:.1f}s")
        print(f"  Latency P95:  {latencies_sorted[p95_idx]:.1f}s")
        print(f"  Latency P99:  {latencies_sorted[p99_idx]:.1f}s")
        print(f"  Latency avg:  {statistics.mean(latencies):.1f}s")
    else:
        print("  Latency:      (no paired RUNNING→DONE callbacks)")

    fastapi_stats = metrics.get("fastapi_stats", {})
    if fastapi_stats:
        print(f"  Mock delay:   {fastapi_stats.get('mock_delay', '?')}s")
        print(f"  Failure rate: {fastapi_stats.get('mock_failure_rate', '?')}")

    print(f"{'=' * 50}")


def run_scenario(
    scenario_key: str,
    *,
    rabbitmq_host: str = "localhost",
    rabbitmq_port: int = 5672,
    rabbitmq_username: str = "guest",
    rabbitmq_password: str = "guest",
    mock_fastapi_url: str = "http://localhost:8000",
    mock_spring_url: str = "http://localhost:8080",
    timeout: int = 600,
) -> None:
    scenario = SCENARIOS[scenario_key]
    msg_count = scenario["count"]
    findings = scenario["findings_per_msg"]

    print(f"\n{'#' * 50}")
    print(f"  Scenario: {scenario_key} — {scenario['name']}")
    print(f"  {scenario['description']}")
    print(f"  Messages: {msg_count}, Findings/msg: {findings}")
    print(f"{'#' * 50}")

    if not check_services(mock_fastapi_url, mock_spring_url, rabbitmq_host, rabbitmq_port):
        print("\n[ABORT] Not all services are reachable.")
        sys.exit(1)

    print("\nResetting mock servers...")
    http_post_json(f"{mock_fastapi_url}/stats/reset")
    http_post_json(f"{mock_spring_url}/callbacks/reset")

    print(f"\nPublishing {msg_count} messages...")
    publish_messages(
        host=rabbitmq_host,
        port=rabbitmq_port,
        username=rabbitmq_username,
        password=rabbitmq_password,
        count=msg_count,
        findings_per_msg=findings,
    )

    summary = wait_for_completion(mock_spring_url, msg_count, timeout=timeout)
    metrics = collect_metrics(mock_spring_url, mock_fastapi_url)
    print_results(f"{scenario_key}: {scenario['name']}", metrics, msg_count)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load test orchestrator")
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS.keys()),
        required=True,
        help="Test scenario to run",
    )
    parser.add_argument("--rabbitmq-host", default="localhost")
    parser.add_argument("--rabbitmq-port", type=int, default=5672)
    parser.add_argument("--rabbitmq-username", default="guest")
    parser.add_argument("--rabbitmq-password", default="guest")
    parser.add_argument("--mock-fastapi-url", default="http://localhost:8000")
    parser.add_argument("--mock-spring-url", default="http://localhost:8080")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    run_scenario(
        args.scenario,
        rabbitmq_host=args.rabbitmq_host,
        rabbitmq_port=args.rabbitmq_port,
        rabbitmq_username=args.rabbitmq_username,
        rabbitmq_password=args.rabbitmq_password,
        mock_fastapi_url=args.mock_fastapi_url,
        mock_spring_url=args.mock_spring_url,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    main()
