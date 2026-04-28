import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.loaders.scan_loader import (  # noqa: E402
    extract_findings,
    load_scan_result,
    validate_findings_required_fields,
)
from app.services.explain_service import generate_finding_explanation  # noqa: E402


def main():
    scan_result = load_scan_result("data/scan_result.json")
    findings = extract_findings(scan_result)
    validate_findings_required_fields(findings)

    first_finding = findings[0]
    explanation = generate_finding_explanation(first_finding)

    print(f"Finding ID: {first_finding['id']}")
    print(explanation)


if __name__ == "__main__":
    main()
