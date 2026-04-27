from __future__ import annotations

import pytest

from ssafer.core.sanitize import (
    is_safe_key,
    make_masked_evidence,
    sanitize_compose_yaml,
    sanitize_string,
)


def test_aws_access_key_is_masked():
    result = sanitize_string("AKIAIOSFODNN7EXAMPLE")
    assert "AKIAIOSFODNN7EXAMPLE" not in result
    assert "AKIA****MASKED****" in result


def test_private_key_block_is_masked():
    pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQ\n-----END RSA PRIVATE KEY-----"
    result = sanitize_string(pem)
    assert "MIIEowIBAAKCAQ" not in result
    assert "[PRIVATE KEY REDACTED]" in result


def test_openssh_private_key_is_masked():
    pem = "-----BEGIN OPENSSH PRIVATE KEY-----\naabbccdd\n-----END OPENSSH PRIVATE KEY-----"
    result = sanitize_string(pem)
    assert "aabbccdd" not in result
    assert "[PRIVATE KEY REDACTED]" in result


def test_safe_key_node_env_not_masked():
    assert is_safe_key("NODE_ENV") is True
    assert is_safe_key("node_env") is True


def test_safe_key_port_not_masked():
    assert is_safe_key("PORT") is True


def test_safe_key_debug_not_masked():
    assert is_safe_key("DEBUG") is True


def test_secret_key_not_safe():
    assert is_safe_key("DB_PASSWORD") is False
    assert is_safe_key("API_KEY") is False
    assert is_safe_key("SECRET_TOKEN") is False


def test_make_masked_evidence_basic():
    evidence = make_masked_evidence("DB_PASSWORD")
    assert evidence == "DB_PASSWORD=***MASKED***"
    assert "***MASKED***" in evidence


def test_make_masked_evidence_truncates_at_120():
    long_key = "A" * 200
    evidence = make_masked_evidence(long_key)
    assert len(evidence) <= 120


def test_make_masked_evidence_no_raw_value():
    evidence = make_masked_evidence("SECRET_KEY", "***MASKED***")
    assert "super-secret-value" not in evidence


def test_sanitize_compose_yaml_safe_key_preserved():
    raw = """
services:
  app:
    environment:
      NODE_ENV: production
      DB_PASSWORD: supersecret
"""
    result = sanitize_compose_yaml(raw)
    assert "production" in result
    assert "supersecret" not in result


def test_sanitize_compose_yaml_port_preserved():
    raw = """
services:
  app:
    environment:
      PORT: "8080"
      API_KEY: myapikey123
"""
    result = sanitize_compose_yaml(raw)
    assert "8080" in result
    assert "myapikey123" not in result
