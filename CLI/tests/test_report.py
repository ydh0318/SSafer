from rich.console import Console

import ssafer.main as main
from ssafer.main import _format_report_evidence, _format_scan_warning, _group_report_findings, _join_compact


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
            "ruleId": "COMPOSE_LATEST",
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


def test_group_report_findings_prefers_file_path_and_line():
    grouped = _group_report_findings([
        {
            "id": "FND-0001",
            "ruleId": "COMPOSE_EXPOSED_DB_PORT",
            "severity": "CRITICAL",
            "file": "docker-compose (front)",
            "filePath": "Frontend\\docker-compose.front.yml",
            "line": 12,
            "title": "db port exposed",
            "maskedEvidence": "services.postgres.ports=5432:5432",
        }
    ])

    assert grouped[0]["location"] == "Frontend\\docker-compose.front.yml:12"


def test_group_report_findings_uses_target_files_when_file_path_is_ambiguous():
    grouped = _group_report_findings([
        {
            "id": "FND-0001",
            "ruleId": "COMPOSE_EXPOSED_DB_PORT",
            "severity": "CRITICAL",
            "file": "docker-compose (default)",
            "targetFiles": ["a.yml", "b.yml", "c.yml", "d.yml"],
            "title": "db port exposed",
            "maskedEvidence": "services.postgres.ports=5432:5432",
        }
    ])

    assert grouped[0]["location"] == "a.yml, b.yml, c.yml +1"


def test_join_compact_shows_remaining_count():
    assert _join_compact(["a", "b", "c", "d"], max_items=2) == "a, b +2"


def test_scan_status_label_shows_empty_targets_instead_of_failed():
    scan = {
        "analysisStatus": "FAILED",
        "cliSummary": {
            "composeSets": 0,
            "envFiles": 0,
            "dockerfiles": 0,
        },
    }

    assert "스캔 대상 없음" in main._scan_status_label(scan)


def test_print_scan_summary_guides_when_no_targets(monkeypatch):
    record_console = Console(record=True, width=120)
    monkeypatch.setattr(main, "console", record_console)

    main._print_scan_summary(
        {
            "analysisStatus": "FAILED",
            "cliSummary": {
                "composeSets": 0,
                "envFiles": 0,
                "dockerfiles": 0,
                "customRuleFindings": 0,
                "trivyFindings": 0,
                "totalFindings": 0,
                "warnings": 0,
            },
            "warnings": [],
        }
    )

    output = record_console.export_text()

    assert "스캔 대상 없음" in output
    assert "ssafer run --path .." in output


def test_group_report_findings_localizes_trivy_messages():
    grouped = _group_report_findings([
        {
            "id": "FND-0001",
            "ruleId": "DS-0002",
            "source": "trivy",
            "severity": "HIGH",
            "file": "Dockerfile",
            "title": "Image user should not be 'root'",
            "maskedEvidence": "Last USER command in Dockerfile should not be 'root'",
        }
    ])

    assert grouped[0]["ruleId"] == "DOCKER_ROOT_USER"
    assert grouped[0]["title"] == "Dockerfile이 root 사용자로 실행됨"
    assert grouped[0]["evidence"] == "USER root 또는 non-root USER 미지정"


def test_format_scan_warning_summarizes_compose_missing_variables():
    warning = "\n".join([
        'time="2026-05-07T12:26:52+09:00" level=warning msg="The \\"POSTGRES_PASSWORD\\" variable is not set. Defaulting to a blank string."',
        'time="2026-05-07T12:26:52+09:00" level=warning msg="The \\"REDIS_PASSWORD\\" variable is not set. Defaulting to a blank string."',
        'time="2026-05-07T12:26:52+09:00" level=warning msg="The \\"POSTGRES_PASSWORD\\" variable is not set. Defaulting to a blank string."',
    ])

    assert _format_scan_warning(warning) == "Docker Compose 환경변수 미설정: POSTGRES_PASSWORD, REDIS_PASSWORD"


def test_format_scan_warning_summarizes_compose_service_without_image():
    warning = 'service "spring" has neither an image nor a build context specified: invalid compose project'

    assert _format_scan_warning(warning) == "Compose 서비스 'spring'에 image/build 설정이 없어 분석하지 못함"


def test_format_scan_warning_summarizes_standalone_compose_file():
    warning = (
        r"C:\Users\SSAFY\Desktop\S14P31B105\Frontend\docker-compose.front.yml을 "
        "함께 쓸 기본 Compose 파일 없이 단독으로 분석했습니다."
    )

    assert _format_scan_warning(warning) == "기본 Compose 없이 단독 분석: docker-compose.front.yml"


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
