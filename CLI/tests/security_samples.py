AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
PRIVATE_KEY_BLOCK = "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----"
PLAIN_TOKEN = "plain-api-token"
PLAIN_PASSWORD = "plain-db-password"

MASKED_VALUE = "***MASKED***"
MASKED_AWS_ACCESS_KEY = "AKIA****MASKED****"
MASKED_PRIVATE_KEY = "[PRIVATE KEY REDACTED]"

PLACEHOLDER_API_KEY = "your_api_key_here"
PLACEHOLDER_PASSWORD = "${DB_PASSWORD}"
PLACEHOLDER_TOKEN = "replace_me"


def trivy_secret_result(match: str = AWS_ACCESS_KEY) -> dict:
    return {
        "Results": [
            {
                "Target": "Dockerfile",
                "Secrets": [
                    {
                        "RuleID": "aws-access-key-id",
                        "Title": "AWS Access Key",
                        "Severity": "HIGH",
                        "StartLine": 4,
                        "Match": match,
                    }
                ],
            }
        ]
    }


def scan_payload_with_trivy_secret(match: str = AWS_ACCESS_KEY) -> dict:
    return {
        "schemaVersion": "0.1",
        "scanId": "local-scan-test",
        "source": "cli",
        "analysisStatus": "SUCCESS",
        "warnings": [],
        "findings": [
            {
                "id": "FND-0001",
                "ruleId": "aws-access-key-id",
                "source": "trivy",
                "severity": "HIGH",
                "file": "Dockerfile",
                "line": 4,
                "title": "AWS Access Key",
                "maskedEvidence": match,
            }
        ],
        "artifacts": [
            {
                "type": "trivy-json",
                "target": "Dockerfile",
                "hash": "sha256:abc123",
                "content": trivy_secret_result(match),
            }
        ],
        "targets": {
            "envFiles": [],
            "dockerfiles": ["Dockerfile"],
            "composeSets": [],
        },
        "cliSummary": {
            "totalFindings": 1,
            "warnings": 0,
        },
    }


def sanitized_scan_payload_with_trivy_secret() -> dict:
    return scan_payload_with_trivy_secret(MASKED_VALUE)
