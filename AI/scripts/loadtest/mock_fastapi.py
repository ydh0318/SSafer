"""FastAPI 목 서버 — 부하테스트용.

사용법:
    uvicorn scripts.loadtest.mock_fastapi:app --port 8000

환경변수:
    MOCK_DELAY_SECONDS  — 응답 지연 (기본 5.0초)
    MOCK_FAILURE_RATE   — 실패 확률 0.0~1.0 (기본 0.0)
"""

import asyncio
import os
import random
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI(title="LoadTest Mock FastAPI")

MOCK_DELAY_SECONDS = float(os.getenv("MOCK_DELAY_SECONDS", "5.0"))
MOCK_FAILURE_RATE = float(os.getenv("MOCK_FAILURE_RATE", "0.0"))

_stats = {
    "total_requests": 0,
    "completed": 0,
    "failed": 0,
    "started_at": None,
}


@app.post("/analyze")
async def analyze(request: Request):
    body = await request.json()
    _stats["total_requests"] += 1
    if _stats["started_at"] is None:
        _stats["started_at"] = time.monotonic()

    await asyncio.sleep(MOCK_DELAY_SECONDS)

    if random.random() < MOCK_FAILURE_RATE:
        _stats["failed"] += 1
        return JSONResponse(
            status_code=500,
            content={
                "status": "failed",
                "error_code": "MOCK_FAILURE",
                "message": "Simulated failure",
                "stage": "analysis",
                "scan_result_path": body.get("rawResultPath", ""),
                "analysis_result_path": body.get("analysisResultPath", ""),
                "finding_count": 0,
                "valid_finding_count": 0,
                "invalid_finding_count": 0,
                "result_count": 0,
                "invalid_findings": [],
            },
        )

    _stats["completed"] += 1
    return {
        "status": "completed",
        "scan_result_path": body.get("rawResultPath", ""),
        "analysis_result_path": body.get("analysisResultPath", ""),
        "finding_count": body.get("resultCount", 5),
        "valid_finding_count": body.get("resultCount", 5),
        "invalid_finding_count": 0,
        "result_count": body.get("resultCount", 5),
        "invalid_findings": [],
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/stats")
def stats():
    elapsed = 0.0
    if _stats["started_at"] is not None:
        elapsed = time.monotonic() - _stats["started_at"]
    return {
        **_stats,
        "elapsed_seconds": round(elapsed, 2),
        "mock_delay": MOCK_DELAY_SECONDS,
        "mock_failure_rate": MOCK_FAILURE_RATE,
    }


@app.post("/stats/reset")
def reset_stats():
    _stats["total_requests"] = 0
    _stats["completed"] = 0
    _stats["failed"] = 0
    _stats["started_at"] = None
    return {"status": "reset"}
