from __future__ import annotations

import platform
import shutil

from typer.testing import CliRunner

from ssafer.core import doctor
from ssafer.main import app


def test_install_tools_supports_linux_trivy_install(monkeypatch):
    commands: list[list[str]] = []

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(doctor, "trivy_version", lambda: None)
    monkeypatch.setattr(shutil, "which", lambda name: "/usr/bin/sudo" if name == "sudo" else None)

    def fake_run_install_command(command: list[str]) -> tuple[bool, str]:
        commands.append(command)
        return True, "ok"

    monkeypatch.setattr(doctor, "_run_install_command", fake_run_install_command)

    ok, message = doctor.install_trivy_with_winget()

    assert ok is True
    assert "Trivy installation finished" in message
    assert ["sudo", "apt-get", "install", "-y", "trivy"] in commands


def test_install_tools_linux_requires_sudo(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(doctor, "trivy_version", lambda: None)
    monkeypatch.setattr(shutil, "which", lambda name: None)

    ok, message = doctor.install_trivy_with_winget()

    assert ok is False
    assert "sudo was not found" in message


def test_install_tools_command_prints_progress_before_install(monkeypatch):
    monkeypatch.setattr("ssafer.main.install_trivy_with_winget", lambda: (True, "Trivy installed"))

    result = CliRunner().invoke(app, ["install-tools"])

    assert result.exit_code == 0
    assert "Installing Trivy. This can take a few minutes..." in result.output
    assert "Trivy installed" in result.output
