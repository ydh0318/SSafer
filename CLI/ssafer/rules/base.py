from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from ssafer.core.constants import ENV_SEVERITY_OVERRIDES

if TYPE_CHECKING:
    from ssafer.rules.engine import ScanContext


@dataclass
class Finding:
    rule_id: str
    source: str
    severity: str
    file: str
    line: int | None
    title: str
    masked_evidence: str
    file_path: str | None = None
    target_files: list[str] = field(default_factory=list)
    patch_context: dict | None = None
    id: str = field(default="")

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "ruleId": self.rule_id,
            "source": self.source,
            "severity": self.severity,
            "file": self.file,
            "line": self.line,
            "title": self.title,
            "maskedEvidence": self.masked_evidence,
        }
        if self.file_path:
            data["filePath"] = self.file_path
        if self.target_files:
            data["targetFiles"] = self.target_files
        if self.patch_context:
            data["patchContext"] = self.patch_context
        return data


class BaseRule(ABC):
    rule_id: str
    severity: str

    def effective_severity(self, environment: str) -> str:
        return ENV_SEVERITY_OVERRIDES.get((self.rule_id, environment), self.severity)

    @abstractmethod
    def check(self, context: "ScanContext") -> list[Finding]: ...
