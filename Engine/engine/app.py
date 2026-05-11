from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse

from engine.upload_scanner import scan_uploaded_files

app = FastAPI(title="ssafer-engine", version="0.1.0")

_INTERNAL_TOKEN: str | None = os.environ.get("INTERNAL_TOKEN")
_TEMP_ROOT = Path(os.environ.get("SCAN_TEMP_ROOT", "/tmp/ssafer/engine"))
_MAX_FILE_COUNT = int(os.environ.get("SCAN_MAX_FILE_COUNT", "20"))
_MAX_UPLOAD_BYTES = int(os.environ.get("SCAN_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))


def _verify_token(x_internal_token: str | None = Header(None)) -> None:
    if _INTERNAL_TOKEN and x_internal_token != _INTERNAL_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid or missing internal token")


@app.get("/health")
def health(response: Response) -> dict:
    trivy_available = shutil.which("trivy") is not None
    if not trivy_available:
        response.status_code = 503
        return {"status": "unhealthy", "trivy": False}
    return {"status": "ok", "trivy": True}


@app.post("/api/v1/scan/upload")
async def scan_upload(
    files: list[UploadFile],
    x_internal_token: str | None = Header(None),
) -> JSONResponse:
    _verify_token(x_internal_token)

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > _MAX_FILE_COUNT:
        raise HTTPException(status_code=413, detail="Too many files")

    scan_id = uuid.uuid4().hex[:12]
    temp_dir = _TEMP_ROOT / scan_id
    temp_dir.mkdir(parents=True, exist_ok=True)

    try:
        saved_paths: list[Path] = []
        total_bytes = 0
        used_names: set[str] = set()
        for idx, upload_file in enumerate(files, start=1):
            if not upload_file.filename:
                continue
            safe_name = _safe_upload_filename(upload_file.filename, idx, used_names)
            dest = temp_dir / safe_name
            content = await upload_file.read()
            total_bytes += len(content)
            if total_bytes > _MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Uploaded files are too large")
            dest.write_bytes(content)
            saved_paths.append(dest)

        if not saved_paths:
            raise HTTPException(status_code=400, detail="No valid files to scan")

        findings, warnings = scan_uploaded_files(saved_paths, temp_dir)

        return JSONResponse(content={"findings": findings, "warnings": warnings})
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _safe_upload_filename(filename: str, index: int, used_names: set[str]) -> str:
    basename = Path(filename.replace("\\", "/")).name.strip()
    if not basename or basename in {".", ".."}:
        basename = f"upload-{index}"

    candidate = basename
    if candidate in used_names:
        path = Path(basename)
        stem = path.stem or "upload"
        suffix = path.suffix
        candidate = f"{stem}-{index}{suffix}"

    used_names.add(candidate)
    return candidate
