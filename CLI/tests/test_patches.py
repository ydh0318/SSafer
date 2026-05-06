from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from ssafer.core.hashing import hash_file
from ssafer.core.patches import (
    PatchError,
    apply_patch_candidate,
    apply_patch_candidates,
    extract_patch_candidates,
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
    assert "SUCCESS" in result.output
    assert target.read_text(encoding="utf-8") == "FROM alpine\nUSER appuser\n"


def test_apply_command_uses_default_analysis_result_and_interactive_selection(tmp_path: Path):
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

    result = CliRunner().invoke(app, ["apply", "--path", str(tmp_path)], input="2\ny\n")

    assert result.exit_code == 0
    assert "P1" in result.output
    assert "P2" in result.output
    assert first.read_text(encoding="utf-8") == "USER root\n"
    assert second.read_text(encoding="utf-8") == "TOKEN=your_token_here\n"


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
        input="3\ny\n",
    )

    assert result.exit_code == 0
    assert first.read_text(encoding="utf-8") == "new a"
    assert second.read_text(encoding="utf-8") == "new b"
