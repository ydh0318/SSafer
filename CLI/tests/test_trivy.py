from pathlib import Path

from ssafer.core import trivy


def test_find_trivy_executable_prefers_path(monkeypatch):
    monkeypatch.setattr(trivy.shutil, "which", lambda name: "C:\\Tools\\trivy.exe" if name == "trivy" else None)

    assert trivy.find_trivy_executable() == "C:\\Tools\\trivy.exe"


def test_find_trivy_executable_checks_winget_package_dir(tmp_path: Path, monkeypatch):
    package_dir = tmp_path / "Microsoft" / "WinGet" / "Packages" / "AquaSecurity.Trivy_Source"
    package_dir.mkdir(parents=True)
    executable = package_dir / "trivy.exe"
    executable.write_text("", encoding="utf-8")

    monkeypatch.setattr(trivy.shutil, "which", lambda name: None)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))

    assert trivy.find_trivy_executable() == str(executable)


def test_find_trivy_executable_returns_none_when_missing(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(trivy.shutil, "which", lambda name: None)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))

    assert trivy.find_trivy_executable() is None


def test_sanitize_trivy_json_masks_secret_match():
    raw = {
        "Results": [
            {
                "Secrets": [
                    {
                        "RuleID": "aws-access-key-id",
                        "Severity": "HIGH",
                        "Match": "AKIAIOSFODNN7EXAMPLE",
                    }
                ]
            }
        ]
    }

    sanitized = trivy.sanitize_trivy_json(raw)

    assert sanitized["Results"][0]["Secrets"][0]["Match"] == "***MASKED***"
    assert raw["Results"][0]["Secrets"][0]["Match"] == "AKIAIOSFODNN7EXAMPLE"


def test_sanitize_trivy_json_masks_cause_metadata_code_lines():
    raw = {
        "Results": [
            {
                "Misconfigurations": [
                    {
                        "ID": "DS001",
                        "CauseMetadata": {
                            "Code": {
                                "Lines": [
                                    {
                                        "Number": 3,
                                        "Content": "ENV AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
                                    }
                                ]
                            }
                        },
                    }
                ],
                "Secrets": [
                    {
                        "RuleID": "private-key",
                        "Match": "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
                        "CauseMetadata": {
                            "Code": {
                                "Lines": [
                                    {
                                        "Number": 4,
                                        "Content": "PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
                                    }
                                ]
                            }
                        },
                    }
                ],
            }
        ]
    }

    sanitized = trivy.sanitize_trivy_json(raw)
    misconfig_content = sanitized["Results"][0]["Misconfigurations"][0]["CauseMetadata"]["Code"]["Lines"][0]["Content"]
    secret_content = sanitized["Results"][0]["Secrets"][0]["CauseMetadata"]["Code"]["Lines"][0]["Content"]

    assert "AKIAIOSFODNN7EXAMPLE" not in misconfig_content
    assert "AKIA****MASKED****" in misconfig_content
    assert "abc" not in secret_content
    assert "[PRIVATE KEY REDACTED]" in secret_content
