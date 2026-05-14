"""Spring callback 수집 목 서버 — 부하테스트용.

사용법:
    uvicorn scripts.loadtest.mock_spring:app --port 8080
"""

import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request

app = FastAPI(title="LoadTest Mock Spring")

_callbacks: list[dict] = []
_started_at: float | None = None


@app.post("/api/v1/internal/scans/{scan_id}/analysis-results")
async def receive_callback(scan_id: int, request: Request):
    global _started_at
    body = await request.json()
    if _started_at is None:
        _started_at = time.monotonic()

    _callbacks.append({
        "scan_id": scan_id,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "received_monotonic": time.monotonic(),
        **body,
    })
    return {"success": True}


@app.get("/callbacks")
def list_callbacks():
    elapsed = 0.0
    if _started_at is not None:
        elapsed = time.monotonic() - _started_at

    done = [c for c in _callbacks if c.get("status") == "DONE"]
    failed = [c for c in _callbacks if c.get("status") == "FAILED"]
    running = [c for c in _callbacks if c.get("status") == "RUNNING"]

    return {
        "total": len(_callbacks),
        "done": len(done),
        "failed": len(failed),
        "running": len(running),
        "elapsed_seconds": round(elapsed, 2),
        "callbacks": _callbacks,
    }


@app.get("/callbacks/summary")
def callback_summary():
    done = [c for c in _callbacks if c.get("status") == "DONE"]
    failed = [c for c in _callbacks if c.get("status") == "FAILED"]

    scan_ids_done = sorted(set(c["scan_id"] for c in done))
    scan_ids_failed = sorted(set(c["scan_id"] for c in failed))

    return {
        "total_callbacks": len(_callbacks),
        "done_count": len(done),
        "failed_count": len(failed),
        "scan_ids_done": scan_ids_done,
        "scan_ids_failed": scan_ids_failed,
    }


@app.post("/callbacks/reset")
def reset_callbacks():
    global _started_at
    _callbacks.clear()
    _started_at = None
    return {"status": "reset"}


@app.get("/health")
def health():
    return {"status": "ok"}
