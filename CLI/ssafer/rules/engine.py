from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ssafer.core.compose import ComposeSet
from ssafer.rules.base import BaseRule, Finding


@dataclass
class ScanContext:
    compose_sets: list[ComposeSet]
    effective_configs: dict[str, str]  # compose_set.name → raw_yaml
    env_files: list[Path]
    project_root: Path
    environment: str = "production"


class RuleEngine:
    def __init__(
        self,
        rules: list[BaseRule] | None = None,
        excluded_rule_ids: list[str] | None = None,
    ) -> None:
        if rules is None:
            from ssafer.rules.compose_rules import (
                ComposeExposedDbPortRule,
                ComposeHardcodedSecretRule,
                ComposeHostNetworkRule,
                ComposeLatestTagRule,
                ComposeNoMemoryLimitRule,
                ComposePrivilegedModeRule,
                ComposeRootUserRule,
            )
            from ssafer.rules.env_rules import EnvPlainSecretRule

            rules = [
                ComposeExposedDbPortRule(),
                ComposePrivilegedModeRule(),
                ComposeHostNetworkRule(),
                ComposeHardcodedSecretRule(),
                ComposeLatestTagRule(),
                ComposeRootUserRule(),
                ComposeNoMemoryLimitRule(),
                EnvPlainSecretRule(),
            ]
        excluded = set(excluded_rule_ids or [])
        self._rules = [
            rule for rule in rules
            if getattr(rule, "rule_id", rule.__class__.__name__) not in excluded
        ]
        self.warnings: list[str] = []

    def run(self, context: ScanContext) -> list[Finding]:
        findings: list[Finding] = []
        self.warnings = []
        for rule in self._rules:
            try:
                findings.extend(rule.check(context))
            except Exception as exc:
                rule_id = getattr(rule, "rule_id", rule.__class__.__name__)
                self.warnings.append(f"Rule {rule_id} failed: {exc}")

        for idx, finding in enumerate(findings, start=1):
            finding.id = f"FND-{idx:04d}"

        return findings
