import json
from pathlib import Path
from typing import Any


def load_scan_result(scan_result_path: str) -> dict[str, Any]:
    path = Path(scan_result_path)

    if not path.is_absolute():
        path = Path.cwd() / path

    if not path.exists():
        raise FileNotFoundError(f"scan_result.json file not found: {path}")

    try:
        with path.open("r", encoding="utf-8-sig") as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON file: {path}") from exc

    if not isinstance(data, dict):
        raise ValueError("scan_result.json root must be a JSON object.")

    return data


def extract_findings(scan_result: dict[str, Any]) -> list[dict[str, Any]]:
    findings = scan_result.get("findings")

    if findings is None:
        raise ValueError("scan_result.json must contain a findings field.")

    if not isinstance(findings, list):
        raise ValueError("scan_result.json findings field must be an array.")

    for index, finding in enumerate(findings):
        if not isinstance(finding, dict):
            raise ValueError(f"findings[{index}] must be a JSON object.")

    return findings
