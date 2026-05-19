from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from typer.testing import CliRunner

from ssafer.core.hashing import hash_file
from ssafer.core.patches import (
    PatchError,
    apply_patch_candidate,
    apply_patch_candidates,
    extract_patch_candidates,
    find_default_analysis_result,
)
from ssafer.main import app


def test_extract_patch_candidates_from_analysis_result_fix_patch():
    payload = {
        "results": [
            {
                "findingId": "FND-0001",
                "file": "Dockerfile",
                "fix": {
                    "summary": "Use non-root user",
                    "patch": {
                        "patchId": "PATCH-1",
                        "operation": "replace",
                        "oldText": "USER root",
                        "newText": "USER appuser",
                    },
                },
            }
        ]
    }

    candidates = extract_patch_candidates(payload)

    assert len(candidates) == 1
    assert candidates[0].patch_id == "PATCH-1"
    assert candidates[0].finding_id == "FND-0001"
    assert candidates[0].file_path == "Dockerfile"
    assert candidates[0].old_text == "USER root"
    assert candidates[0].new_text == "USER appuser"


def test_extract_patch_candidates_from_top_level_patches():
    candidates = extract_patch_candidates(
        {
            "patches": [
                {
                    "id": "P1",
                    "findingId": "FND-0002",
                    "filePath": ".env.example",
                    "operation": "replace",
                    "oldText": "TOKEN=secret",
                    "newText": "TOKEN=your_token_here",
                }
            ]
        }
    )

    assert len(candidates) == 1
    assert candidates[0].patch_id == "P1"
    assert candidates[0].file_path == ".env.example"


def test_extract_patch_candidates_from_analysis_result_fix_patches():
    payload = {
        "results": [
            {
                "findingId": "FND-0001",
                "file": "Dockerfile",
                "fix": {
                    "summary": "Use safer Dockerfile settings",
                    "patches": [
                        {
                            "patchId": "PATCH-FND-0001",
                            "operation": "replace",
                            "filePath": "Dockerfile",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                            "expectedFileHash": "sha256:abc",
                        }
                    ],
                },
            }
        ]
    }

    candidates = extract_patch_candidates(payload)

    assert len(candidates) == 1
    assert candidates[0].patch_id == "PATCH-FND-0001"
    assert candidates[0].finding_id == "FND-0001"
    assert candidates[0].file_path == "Dockerfile"
    assert candidates[0].expected_file_hash == "sha256:abc"


def test_apply_patch_candidate_replaces_text_and_writes_backup(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "Dockerfile",
                    "oldText": "USER root",
                    "newText": "USER appuser",
                    "expectedFileHash": hash_file(target),
                }
            ]
        }
    )[0]

    result = apply_patch_candidate(tmp_path, candidate)

    assert result.status == "SUCCESS"
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"
    assert result.backup_path is not None
    assert Path(result.backup_path).read_text(encoding="utf-8") == "FROM alpine\nUSER root\n"


def test_extract_patch_candidates_allows_append_without_old_text():
    candidates = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "Dockerfile",
                    "operation": "append",
                    "newText": "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n",
                }
            ]
        }
    )

    assert len(candidates) == 1
    assert candidates[0].operation == "append"
    assert candidates[0].old_text is None
    assert candidates[0].new_text == "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n"


def test_apply_patch_candidate_appends_text_and_writes_backup(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM nginx\n", encoding="utf-8")
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "Dockerfile",
                    "operation": "append",
                    "newText": "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n",
                    "expectedFileHash": hash_file(target),
                }
            ]
        }
    )[0]

    result = apply_patch_candidate(tmp_path, candidate)

    assert result.status == "SUCCESS"
    assert target.read_text(encoding="utf-8") == (
        "FROM nginx\n\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n"
    )
    assert result.backup_path is not None
    assert Path(result.backup_path).read_text(encoding="utf-8") == "FROM nginx\n"


def test_apply_patch_candidate_append_dry_run_does_not_modify_file(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM nginx\n", encoding="utf-8")
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "Dockerfile",
                    "operation": "append",
                    "newText": "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n",
                }
            ]
        }
    )[0]

    result = apply_patch_candidate(tmp_path, candidate, dry_run=True)

    assert result.status == "DRY_RUN"
    assert target.read_text(encoding="utf-8") == "FROM nginx\n"


def test_apply_patch_candidate_rejects_path_outside_project(tmp_path: Path):
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "../outside.txt",
                    "oldText": "old",
                    "newText": "new",
                }
            ]
        }
    )[0]

    with pytest.raises(PatchError, match="escapes project root"):
        apply_patch_candidate(tmp_path, candidate)


def test_apply_patch_candidate_rejects_multiple_old_text_matches(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("USER root\nUSER root\n", encoding="utf-8")
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "Dockerfile",
                    "oldText": "USER root",
                    "newText": "USER appuser",
                }
            ]
        }
    )[0]

    with pytest.raises(PatchError, match="multiple locations"):
        apply_patch_candidate(tmp_path, candidate)


def test_apply_patch_candidates_filters_by_patch_id(tmp_path: Path):
    first = tmp_path / "first.txt"
    second = tmp_path / "second.txt"
    first.write_text("old first", encoding="utf-8")
    second.write_text("old second", encoding="utf-8")
    candidates = extract_patch_candidates(
        {
            "patches": [
                {"patchId": "P1", "filePath": "first.txt", "oldText": "old first", "newText": "new first"},
                {"patchId": "P2", "filePath": "second.txt", "oldText": "old second", "newText": "new second"},
            ]
        }
    )

    results = apply_patch_candidates(tmp_path, candidates, patch_id="P2")

    assert [result.patch_id for result in results] == ["P2"]
    assert first.read_text(encoding="utf-8") == "old first"
    assert second.read_text(encoding="utf-8") == "new second"


def test_apply_patch_candidates_validates_hashes_before_multiple_edits_to_same_file(tmp_path: Path):
    target = tmp_path / "docker-compose.yml"
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "    ports:\n"
        "      - \"5432:5432\"\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    expected_hash = hash_file(target)
    candidates = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P1",
                    "filePath": "docker-compose.yml",
                    "oldText": "    ports:\n      - \"5432:5432\"",
                    "newText": "",
                    "expectedFileHash": expected_hash,
                },
                {
                    "patchId": "P2",
                    "filePath": "docker-compose.yml",
                    "oldText": "    ports:\n      - \"6379:6379\"",
                    "newText": "",
                    "expectedFileHash": expected_hash,
                },
            ]
        }
    )

    results = apply_patch_candidates(tmp_path, candidates)

    assert [result.status for result in results] == ["SUCCESS", "SUCCESS"]
    content = target.read_text(encoding="utf-8")
    assert "5432:5432" not in content
    assert "6379:6379" not in content


def test_apply_patch_candidate_can_allow_hash_mismatch_when_old_text_is_unique(tmp_path: Path):
    target = tmp_path / "docker-compose.yml"
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "    ports:\n"
        "      - \"5432:5432\"\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    expected_hash = hash_file(target)
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    candidate = extract_patch_candidates(
        {
            "patches": [
                {
                    "patchId": "P2",
                    "filePath": "docker-compose.yml",
                    "oldText": "    ports:\n      - \"6379:6379\"",
                    "newText": "",
                    "expectedFileHash": expected_hash,
                }
            ]
        }
    )[0]

    result = apply_patch_candidate(tmp_path, candidate, allow_hash_mismatch_if_text_matches=True)

    assert result.status == "SUCCESS"
    assert "6379:6379" not in target.read_text(encoding="utf-8")


def test_apply_command_applies_analysis_result_patch(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "results": [
                    {
                        "findingId": "FND-0001",
                        "file": "Dockerfile",
                        "fix": {
                            "patch": {
                                "patchId": "P1",
                                "oldText": "USER root",
                                "newText": "USER appuser",
                            }
                        },
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result), "--yes"],
    )

    assert result.exit_code == 0
    assert "Patch diff preview" in result.output
    assert "- USER root" in result.output
    assert "+ USER appuser" in result.output
    assert "SUCCESS" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_allows_stale_hash_when_old_text_is_unique(tmp_path: Path):
    target = tmp_path / "docker-compose.yml"
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "    ports:\n"
        "      - \"5432:5432\"\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    expected_hash = hash_file(target)
    target.write_text(
        "services:\n"
        "  postgres:\n"
        "    ports:\n"
        "      - \"127.0.0.1:5432:5432\"\n"
        "  redis:\n"
        "    ports:\n"
        "      - \"6379:6379\"\n",
        encoding="utf-8",
    )
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "patches": [
                    {
                        "patchId": "P2",
                        "filePath": "docker-compose.yml",
                        "oldText": "    ports:\n      - \"6379:6379\"",
                        "newText": "    ports:\n      - \"127.0.0.1:6379:6379\"",
                        "expectedFileHash": expected_hash,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result), "--yes"],
    )

    assert result.exit_code == 0
    assert "SUCCESS" in result.output
    assert "127.0.0.1:6379:6379" in target.read_text(encoding="utf-8")


def test_apply_command_dry_run_does_not_modify_file(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "patches": [
                    {
                        "patchId": "P1",
                        "filePath": "Dockerfile",
                        "oldText": "USER root",
                        "newText": "USER appuser",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result), "--dry-run", "--yes"],
    )

    assert result.exit_code == 0
    assert "Patch diff preview" in result.output
    assert "DRY_RUN" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER root\n"


def test_apply_command_previews_append_patch(tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM nginx\n", encoding="utf-8")
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "patches": [
                    {
                        "patchId": "P1",
                        "filePath": "Dockerfile",
                        "operation": "append",
                        "newText": "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result), "--dry-run", "--yes"],
    )

    assert result.exit_code == 0
    assert "Patch diff preview" in result.output
    assert "DRY_RUN" in result.output
    assert target.read_text(encoding="utf-8") == "FROM nginx\n"


def test_apply_command_without_patch_payload_is_noop(tmp_path: Path):
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "results": [
                    {
                        "findingId": "FND-0001",
                        "file": "Dockerfile",
                        "fix": {
                            "summary": "Review manually",
                            "recommendedActions": ["Remove host port binding."],
                        },
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result)],
        input="y\n",
    )

    assert result.exit_code == 0
    assert "적용할 자동 수정안이 없습니다" in result.output
    assert "Patch apply failed" not in result.output
    assert "수정 적용 실패" not in result.output


def test_apply_command_downloads_analysis_result_by_scan_id(monkeypatch, tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    downloaded = tmp_path / ".ssafer" / "analysis" / "scans" / "123" / "analysis_result.json"
    calls = {}

    def fake_download(project_root: Path, *, scan_id: int, api_url: str, token: str) -> Path:
        calls["args"] = {
            "project_root": project_root,
            "scan_id": scan_id,
            "api_url": api_url,
            "token": token,
        }
        downloaded.parent.mkdir(parents=True)
        downloaded.write_text(
            json.dumps(
                {
                    "patches": [
                        {
                            "patchId": "P1",
                            "filePath": "Dockerfile",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        return downloaded

    monkeypatch.setenv("SSAFER_TOKEN", "access-token")
    monkeypatch.setattr("ssafer.core.analysis_result.download_analysis_result_for_scan", fake_download)

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--scan-id", "123", "--api-url", "https://api.example.com", "--yes"],
    )

    assert result.exit_code == 0
    assert calls["args"] == {
        "project_root": tmp_path.resolve(),
        "scan_id": 123,
        "api_url": "https://api.example.com",
        "token": "access-token",
    }
    assert "scanId=123" in result.output
    assert "Analysis result:" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_accepts_scan_id_argument(monkeypatch, tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    downloaded = tmp_path / ".ssafer" / "analysis" / "scans" / "123" / "analysis_result.json"
    calls = {}

    def fake_download(project_root: Path, *, scan_id: int, api_url: str, token: str) -> Path:
        calls["args"] = {
            "project_root": project_root,
            "scan_id": scan_id,
            "api_url": api_url,
            "token": token,
        }
        downloaded.parent.mkdir(parents=True)
        downloaded.write_text(
            json.dumps(
                {
                    "patches": [
                        {
                            "patchId": "P1",
                            "filePath": "Dockerfile",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        return downloaded

    monkeypatch.setenv("SSAFER_TOKEN", "access-token")
    monkeypatch.setattr("ssafer.core.analysis_result.download_analysis_result_for_scan", fake_download)

    result = CliRunner().invoke(
        app,
        ["apply", "123", "--path", str(tmp_path), "--api-url", "https://api.example.com", "--yes"],
    )

    assert result.exit_code == 0
    assert calls["args"] == {
        "project_root": tmp_path.resolve(),
        "scan_id": 123,
        "api_url": "https://api.example.com",
        "token": "access-token",
    }
    assert "scanId=123" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_prints_web_url_when_remote_scan_has_no_patches(monkeypatch, tmp_path: Path):
    downloaded = tmp_path / ".ssafer" / "analysis" / "scans" / "123" / "analysis_result.json"

    def fake_download(project_root: Path, *, scan_id: int, api_url: str, token: str) -> Path:
        downloaded.parent.mkdir(parents=True)
        downloaded.write_text(json.dumps({"patches": []}), encoding="utf-8")
        return downloaded

    monkeypatch.setenv("SSAFER_TOKEN", "access-token")
    monkeypatch.setattr("ssafer.core.analysis_result.download_analysis_result_for_scan", fake_download)

    result = CliRunner().invoke(
        app,
        [
            "apply",
            "123",
            "--path",
            str(tmp_path),
            "--api-url",
            "https://api.example.com",
        ],
    )

    assert result.exit_code == 0
    assert "https://api.example.com/scans/123" in result.output


def test_apply_command_uses_latest_done_scan(monkeypatch, tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    agent_config = tmp_path / ".ssafer" / "agent.yml"
    agent_config.parent.mkdir(parents=True)
    agent_config.write_text("agentId: 9\nprojectId: 7\nagentToken: agent-token\n", encoding="utf-8")
    downloaded = tmp_path / ".ssafer" / "analysis" / "scans" / "321" / "analysis_result.json"
    calls = {}

    def fake_find_latest(api_url: str, *, project_id: int, token: str) -> int:
        calls["latest"] = {"api_url": api_url, "project_id": project_id, "token": token}
        return 321

    def fake_download(project_root: Path, *, scan_id: int, api_url: str, token: str) -> Path:
        calls["download"] = {
            "project_root": project_root,
            "scan_id": scan_id,
            "api_url": api_url,
            "token": token,
        }
        downloaded.parent.mkdir(parents=True)
        downloaded.write_text(
            json.dumps(
                {
                    "patches": [
                        {
                            "patchId": "P1",
                            "filePath": "Dockerfile",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        return downloaded

    monkeypatch.setenv("SSAFER_TOKEN", "access-token")
    monkeypatch.setattr("ssafer.core.analysis_result.find_latest_done_scan_id", fake_find_latest)
    monkeypatch.setattr("ssafer.core.analysis_result.download_analysis_result_for_scan", fake_download)

    result = CliRunner().invoke(
        app,
        [
            "apply",
            "--path",
            str(tmp_path),
            "--latest",
            "--api-url",
            "https://api.example.com",
            "--yes",
        ],
    )

    assert result.exit_code == 0
    assert calls["latest"] == {"api_url": "https://api.example.com", "project_id": 7, "token": "access-token"}
    assert calls["download"] == {
        "project_root": tmp_path.resolve(),
        "scan_id": 321,
        "api_url": "https://api.example.com",
        "token": "access-token",
    }
    assert "scanId=321" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_defaults_to_latest_done_scan(monkeypatch, tmp_path: Path):
    target = tmp_path / "Dockerfile"
    target.write_text("FROM alpine\nUSER root\n", encoding="utf-8")
    agent_config = tmp_path / ".ssafer" / "agent.yml"
    agent_config.parent.mkdir(parents=True)
    agent_config.write_text("agentId: 9\nprojectId: 7\nagentToken: agent-token\n", encoding="utf-8")
    downloaded = tmp_path / ".ssafer" / "analysis" / "scans" / "321" / "analysis_result.json"
    calls = {}

    def fake_find_latest(api_url: str, *, project_id: int, token: str) -> int:
        calls["latest"] = {"api_url": api_url, "project_id": project_id, "token": token}
        return 321

    def fake_download(project_root: Path, *, scan_id: int, api_url: str, token: str) -> Path:
        calls["download"] = {
            "project_root": project_root,
            "scan_id": scan_id,
            "api_url": api_url,
            "token": token,
        }
        downloaded.parent.mkdir(parents=True)
        downloaded.write_text(
            json.dumps(
                {
                    "patches": [
                        {
                            "patchId": "P1",
                            "filePath": "Dockerfile",
                            "oldText": "USER root",
                            "newText": "USER appuser",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )
        return downloaded

    monkeypatch.setenv("SSAFER_TOKEN", "access-token")
    monkeypatch.setattr("ssafer.core.analysis_result.find_latest_done_scan_id", fake_find_latest)
    monkeypatch.setattr("ssafer.core.analysis_result.download_analysis_result_for_scan", fake_download)

    result = CliRunner().invoke(
        app,
        [
            "apply",
            "--path",
            str(tmp_path),
            "--api-url",
            "https://api.example.com",
            "--yes",
        ],
    )

    assert result.exit_code == 0
    assert calls["latest"] == {"api_url": "https://api.example.com", "project_id": 7, "token": "access-token"}
    assert calls["download"] == {
        "project_root": tmp_path.resolve(),
        "scan_id": 321,
        "api_url": "https://api.example.com",
        "token": "access-token",
    }
    assert "scanId=321" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_rejects_analysis_result_and_scan_id(tmp_path: Path):
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(json.dumps({"patches": []}), encoding="utf-8")

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result), "--scan-id", "123"],
    )

    assert result.exit_code == 1
    assert "Use only one of scanId argument, --analysis-result, --scan-id" in result.output
    assert "or --latest" in result.output


def test_apply_command_uses_explicit_analysis_result_and_interactive_selection(tmp_path: Path):
    first = tmp_path / "Dockerfile"
    second = tmp_path / ".env.example"
    first.write_text("USER root\n", encoding="utf-8")
    second.write_text("TOKEN=secret\n", encoding="utf-8")
    ssafer_dir = tmp_path / ".ssafer"
    ssafer_dir.mkdir()
    (ssafer_dir / "analysis_result.json").write_text(
        json.dumps(
            {
                "patches": [
                    {
                        "patchId": "P1",
                        "findingId": "FND-0001",
                        "filePath": "Dockerfile",
                        "oldText": "USER root",
                        "newText": "USER appuser",
                    },
                    {
                        "patchId": "P2",
                        "findingId": "FND-0002",
                        "filePath": ".env.example",
                        "oldText": "TOKEN=secret",
                        "newText": "TOKEN=your_token_here",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(ssafer_dir / "analysis_result.json")],
        input="y\n2\ny\n",
    )

    assert result.exit_code == 0
    assert "analysis_result.json" in result.output
    assert "Line" in result.output
    assert "FND-0001" in result.output
    assert "P2" in result.output
    assert "- TOKEN=secret" in result.output
    assert "+ TOKEN=your_token_here" in result.output
    assert first.read_text(encoding="utf-8") == "USER root\n"
    assert second.read_text(encoding="utf-8") == "TOKEN=your_token_here\n"


def test_find_default_analysis_result_uses_ai_data_path(tmp_path: Path):
    analysis_dir = tmp_path / "AI" / "data"
    analysis_dir.mkdir(parents=True)
    analysis_result = analysis_dir / "analysis_result.json"
    analysis_result.write_text(json.dumps({"results": []}), encoding="utf-8")

    assert find_default_analysis_result(tmp_path) == analysis_result


def test_find_default_analysis_result_discovers_latest_result(tmp_path: Path):
    older = tmp_path / ".ssafer" / "downloads" / "analysis_result_old.json"
    newer = tmp_path / ".ssafer" / "downloads" / "analysis_result_new.json"
    older.parent.mkdir(parents=True)
    older.write_text(json.dumps({"results": []}), encoding="utf-8")
    newer.write_text(json.dumps({"results": []}), encoding="utf-8")
    os.utime(older, (1_700_000_000, 1_700_000_000))
    os.utime(newer, (1_700_000_100, 1_700_000_100))

    assert find_default_analysis_result(tmp_path) == newer


def test_apply_command_interactive_all_selection(tmp_path: Path):
    first = tmp_path / "a.txt"
    second = tmp_path / "b.txt"
    first.write_text("old a", encoding="utf-8")
    second.write_text("old b", encoding="utf-8")
    analysis_result = tmp_path / "analysis_result.json"
    analysis_result.write_text(
        json.dumps(
            {
                "patches": [
                    {"patchId": "P1", "filePath": "a.txt", "oldText": "old a", "newText": "new a"},
                    {"patchId": "P2", "filePath": "b.txt", "oldText": "old b", "newText": "new b"},
                ]
            }
        ),
        encoding="utf-8",
    )

    result = CliRunner().invoke(
        app,
        ["apply", "--path", str(tmp_path), "--analysis-result", str(analysis_result)],
        input="y\n3\ny\n",
    )

    assert result.exit_code == 0
    assert first.read_text(encoding="utf-8") == "new a"
    assert second.read_text(encoding="utf-8") == "new b"
