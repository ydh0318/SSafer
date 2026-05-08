from pathlib import Path

from ssafer.core.finder import discover_project_files


def test_discover_project_files_ignores_pytest_tmp(tmp_path: Path):
    (tmp_path / "Dockerfile").write_text("FROM alpine\n", encoding="utf-8")
    ignored = tmp_path / "CLI" / ".pytest_tmp" / "fixture"
    ignored.mkdir(parents=True)
    (ignored / "Dockerfile").write_text("FROM alpine\n", encoding="utf-8")
    (ignored / ".env").write_text("SECRET=value\n", encoding="utf-8")

    files = discover_project_files(tmp_path)

    assert files.dockerfiles == [tmp_path / "Dockerfile"]
    assert files.env_files == []
