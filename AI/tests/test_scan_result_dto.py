import unittest

from app.loaders.scan_loader import (
    extract_findings,
    parse_scan_result,
    split_valid_invalid_findings,
)


def build_scan_result(findings=None):
    return {
        "schemaVersion": "0.1",
        "scanId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
        "source": "cli",
        "scannedAt": "2026-04-27T00:26:05Z",
        "analysisStatus": "SUCCESS",
        "findings": findings
        if findings is not None
        else [
            {
                "id": "FND-0001",
                "ruleId": "ENV_PLAIN_SECRET",
                "source": "custom-rule",
                "severity": "HIGH",
                "file": ".env",
                "line": 1,
                "title": "Plain secret in env file",
                "maskedEvidence": "DB_PASSWORD=***MASKED***",
            }
        ],
        "toolVersion": "0.2.0",
    }


class ScanResultDtoTest(unittest.TestCase):
    def test_parse_scan_result_preserves_aliases_and_extra_fields(self):
        parsed = parse_scan_result(build_scan_result())

        self.assertEqual(parsed["schemaVersion"], "0.1")
        self.assertEqual(parsed["scanId"], "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd")
        self.assertEqual(parsed["toolVersion"], "0.2.0")
        self.assertEqual(parsed["findings"][0]["ruleId"], "ENV_PLAIN_SECRET")
        self.assertEqual(
            parsed["findings"][0]["maskedEvidence"],
            "DB_PASSWORD=***MASKED***",
        )

    def test_parse_scan_result_accepts_web_upload_source(self):
        scan_result = build_scan_result()
        scan_result["source"] = "web-upload"

        parsed = parse_scan_result(scan_result)

        self.assertEqual(parsed["source"], "web-upload")
        self.assertEqual(parsed["scanType"], "PROJECT_FILE")

    def test_parse_scan_result_accepts_cli_partial_success_status(self):
        scan_result = build_scan_result()
        scan_result["analysisStatus"] = "PARTIAL_SUCCESS"

        parsed = parse_scan_result(scan_result)

        self.assertEqual(parsed["analysisStatus"], "PARTIAL_SUCCESS")

    def test_parse_scan_result_normalizes_server_audit_shape(self):
        parsed = parse_scan_result(
            {
                "schemaVersion": "0.1",
                "auditId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
                "source": "server-audit",
                "generatedAt": "2026-04-27T00:26:05Z",
                "findings": [
                    {
                        "id": "SRV-0001",
                        "ruleId": "OPEN_PORT",
                        "source": "server-audit",
                        "severity": "HIGH",
                        "target": "port:5432",
                        "title": "DB 포트가 외부에 열려 있음",
                        "evidence": "0.0.0.0:5432 LISTEN",
                    }
                ],
            }
        )

        self.assertEqual(parsed["scanType"], "SERVER_AUDIT")
        self.assertEqual(parsed["scanId"], parsed["auditId"])
        self.assertEqual(parsed["scannedAt"], parsed["generatedAt"])
        self.assertEqual(parsed["analysisStatus"], "SUCCESS")
        self.assertEqual(parsed["findings"][0]["file"], "port:5432")
        self.assertEqual(parsed["findings"][0]["maskedEvidence"], "0.0.0.0:5432 LISTEN")

    def test_split_valid_invalid_findings_accepts_patch_context(self):
        parsed = parse_scan_result(
            build_scan_result(
                findings=[
                    {
                        "id": "FND-0001",
                        "ruleId": "DOCKER_ROOT_USER",
                        "source": "custom-rule",
                        "severity": "HIGH",
                        "file": "Dockerfile",
                        "filePath": "Dockerfile",
                        "line": 12,
                        "title": "Dockerfile runs as root",
                        "maskedEvidence": "USER root",
                        "patchContext": {
                            "operation": "replace",
                            "oldText": "USER root",
                            "expectedFileHash": "sha256:abc123",
                        },
                    }
                ]
            )
        )

        valid_findings, invalid_findings = split_valid_invalid_findings(
            extract_findings(parsed)
        )

        self.assertEqual(len(valid_findings), 1)
        self.assertEqual(valid_findings[0]["patchContext"]["operation"], "replace")
        self.assertEqual(valid_findings[0]["patchContext"]["oldText"], "USER root")
        self.assertEqual(
            valid_findings[0]["patchContext"]["expectedFileHash"],
            "sha256:abc123",
        )
        self.assertEqual(invalid_findings, [])

    def test_parse_scan_result_rejects_invalid_top_level_fields(self):
        scan_result = build_scan_result()
        scan_result["scanId"] = "not-a-uuid"

        with self.assertRaisesRegex(ValueError, "Invalid scan_result.json"):
            parse_scan_result(scan_result)

    def test_split_valid_invalid_findings_uses_finding_dto(self):
        parsed = parse_scan_result(
            build_scan_result(
                findings=[
                    {
                        "id": "FND-0001",
                        "ruleId": "ENV_PLAIN_SECRET",
                        "source": "custom-rule",
                        "severity": "HIGH",
                        "file": ".env",
                        "line": 1,
                        "title": "Plain secret in env file",
                        "maskedEvidence": "DB_PASSWORD=***MASKED***",
                    },
                    {
                        "id": "FND-0002",
                        "ruleId": "DS-0002",
                        "source": "trivy",
                        "severity": "HIGH",
                        "file": "Dockerfile",
                        "line": "two",
                        "title": "Root user",
                        "maskedEvidence": "USER root",
                    },
                ]
            )
        )

        valid_findings, invalid_findings = split_valid_invalid_findings(
            extract_findings(parsed)
        )

        self.assertEqual(len(valid_findings), 1)
        self.assertEqual(valid_findings[0]["id"], "FND-0001")
        self.assertEqual(len(invalid_findings), 1)
        self.assertEqual(invalid_findings[0]["findingId"], "FND-0002")
        self.assertIn("findings[1] invalid", invalid_findings[0]["reason"])


if __name__ == "__main__":
    unittest.main()
