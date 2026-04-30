from rich.console import Console

import ssafer.main as main
from ssafer.main import _format_report_evidence, _group_report_findings, _join_compact


def test_format_report_evidence_uses_dash_for_empty_values():
    assert _format_report_evidence(None) == "-"
    assert _format_report_evidence("") == "-"
    assert _format_report_evidence("   ") == "-"


def test_format_report_evidence_flattens_newlines():
    assert _format_report_evidence("line1\nline2\r\nline3") == "line1 line2  line3"


def test_format_report_evidence_truncates_long_text():
    evidence = "A" * 100
    formatted = _format_report_evidence(evidence)

    assert len(formatted) == 80
    assert formatted.endswith("...")


def test_group_report_findings_compacts_duplicate_compose_findings():
    findings = [
        {
            "id": "FND-0001",
            "ruleId": "COMPOSE_LATEST_TAG",
            "severity": "MEDIUM",
            "file": "docker-compose (default)",
            "title": "service uses latest tag",
            "maskedEvidence": "services.web.image=latest",
        },
        {
            "id": "FND-0002",
            "ruleId": "COMPOSE_LATEST_TAG",
            "severity": "MEDIUM",
            "file": "docker-compose (ec2)",
            "title": "service uses latest tag",
            "maskedEvidence": "services.web.image=latest",
        },
        {
            "id": "FND-0003",
            "ruleId": "COMPOSE_LATEST_TAG",
            "severity": "MEDIUM",
            "file": "docker-compose (local)",
            "title": "service uses latest tag",
            "maskedEvidence": "services.web.image=latest",
        },
    ]

    grouped = _group_report_findings(findings)

    assert grouped == [
        {
            "count": 3,
            "severity": "MEDIUM",
            "ruleId": "COMPOSE_LATEST_TAG",
            "location": "docker-compose (default, ec2, local)",
            "title": "service uses latest tag",
            "evidence": "services.web.image=latest",
            "ids": "FND-0001, FND-0002, FND-0003",
        }
    ]


def test_group_report_findings_keeps_different_evidence_separate():
    findings = [
        {
            "id": "FND-0001",
            "ruleId": "COMPOSE_HARDCODED_SECRET",
            "severity": "HIGH",
            "file": "docker-compose (default)",
            "title": "hardcoded secret in environment",
            "maskedEvidence": "services.kafka.environment.API_KEY=***MASKED***",
        },
        {
            "id": "FND-0002",
            "ruleId": "COMPOSE_HARDCODED_SECRET",
            "severity": "HIGH",
            "file": "docker-compose (default)",
            "title": "hardcoded secret in environment",
            "maskedEvidence": "services.worker.environment.API_KEY=***MASKED***",
        },
    ]

    grouped = _group_report_findings(findings)

    assert len(grouped) == 2
    assert [group["count"] for group in grouped] == [1, 1]


def test_join_compact_shows_remaining_count():
    assert _join_compact(["a", "b", "c", "d"], max_items=2) == "a, b +2"


def test_print_findings_separates_rows_for_readability(monkeypatch):
    record_console = Console(record=True, width=100)
    monkeypatch.setattr(main, "console", record_console)

    main._print_findings(
        {
            "findings": [
                {
                    "id": "FND-0001",
                    "ruleId": "RULE_A",
                    "severity": "HIGH",
                    "file": "docker-compose (dev)",
                    "title": "first finding",
                    "maskedEvidence": "a=***MASKED***",
                },
                {
                    "id": "FND-0002",
                    "ruleId": "RULE_B",
                    "severity": "MEDIUM",
                    "file": "Dockerfile",
                    "title": "second finding",
                    "maskedEvidence": "b=latest",
                },
            ]
        }
    )

    output = record_console.export_text()

    assert "FND-0001" in output
    assert "FND-0002" in output
    assert "├" in output
