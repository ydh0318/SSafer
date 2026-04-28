from __future__ import annotations

from pathlib import Path

from ssafer.core.config import ProjectConfig, load_project_config


def test_load_project_config_returns_defaults_when_missing(tmp_path: Path):
    warnings: list[str] = []

    config = load_project_config(tmp_path, warnings)

    assert config == ProjectConfig()
    assert warnings == []


def test_load_project_config_parses_supported_schema(tmp_path: Path):
    (tmp_path / "ssafer.yml").write_text(
        """
project_name: my-app
upload:
  endpoint: https://api.ssafer.dev
  token_env: SSAFER_TOKEN
rules:
  exclude:
    - DOCKER_LATEST_TAG
masking:
  extra_patterns:
    - name: internal_domain
      regex: "company-internal\\\\.com"
      mask: "[REDACTED]"
""",
        encoding="utf-8",
    )
    warnings: list[str] = []

    config = load_project_config(tmp_path, warnings)

    assert config.project_name == "my-app"
    assert config.upload.endpoint == "https://api.ssafer.dev"
    assert config.upload.token_env == "SSAFER_TOKEN"
    assert config.rules.exclude == ["DOCKER_LATEST_TAG"]
    assert len(config.masking.extra_patterns) == 1
    assert config.masking.extra_patterns[0].name == "internal_domain"
    assert config.masking.extra_patterns[0].regex == "company-internal\\.com"
    assert config.masking.extra_patterns[0].mask == "[REDACTED]"
    assert warnings == []


def test_load_project_config_records_warning_for_invalid_yaml(tmp_path: Path):
    (tmp_path / "ssafer.yml").write_text("upload: [", encoding="utf-8")
    warnings: list[str] = []

    config = load_project_config(tmp_path, warnings)

    assert config == ProjectConfig()
    assert len(warnings) == 1
    assert "Failed to parse ssafer.yml" in warnings[0]


def test_load_project_config_records_warnings_for_invalid_shapes(tmp_path: Path):
    (tmp_path / "ssafer.yml").write_text(
        """
project_name:
  nested: value
upload: true
rules:
  exclude: DOCKER_LATEST_TAG
masking:
  extra_patterns:
    - name: missing-regex
      mask: "[REDACTED]"
""",
        encoding="utf-8",
    )
    warnings: list[str] = []

    config = load_project_config(tmp_path, warnings)

    assert config == ProjectConfig()
    assert any("project_name must be a string" in warning for warning in warnings)
    assert any("upload must be a mapping" in warning for warning in warnings)
    assert any("rules.exclude must be a list" in warning for warning in warnings)
    assert any("requires non-empty name, regex, and mask strings" in warning for warning in warnings)
