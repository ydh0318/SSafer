from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ssafer.rules.engine import ScanContext


@dataclass
class Finding:
    rule_id: str
    source: str        # 항상 "custom-rule"
    severity: str      # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    file: str
    line: int | None
    title: str
    masked_evidence: str  # 최대 120자, 원본값 미포함
    id: str = field(default="")  # RuleEngine에서 FND-{n:04d} 부여

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ruleId": self.rule_id,
            "source": self.source,
            "severity": self.severity,
            "file": self.file,
            "line": self.line,
            "title": self.title,
            "maskedEvidence": self.masked_evidence,
        }


class BaseRule(ABC):
    rule_id: str
    severity: str

    @abstractmethod
    def check(self, context: "ScanContext") -> list[Finding]: ...
