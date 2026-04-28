import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.services.analysis_service import run_analysis_pipeline  # noqa: E402
from app.services.result_service import load_analysis_result  # noqa: E402


def main():
    result = run_analysis_pipeline(
        scan_result_path="data/scan_result.json",
        output_path="data/analysis_result.json",
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    if result["status"] != "completed":
        raise SystemExit(1)

    analysis_result = load_analysis_result(str(result["analysis_result_path"]))
    print(f"Verified result count: {analysis_result['resultCount']}")
    print(f"First finding ID: {analysis_result['results'][0]['findingId']}")


if __name__ == "__main__":
    main()
