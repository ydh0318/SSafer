import json
import logging
import re
from dataclasses import dataclass, replace
from typing import Any

from app.core.config import (
    LLM_FIX_MAX_TOKENS,
    LLM_VERIFY_MAX_TOKENS,
    MAX_VERIFY_RETRIES,
    VERIFY_ENABLED,
    VERIFY_LLM_ENABLED,
)
from app.core.llm import invoke_llm_with_retry
from app.services.input_service import format_finding_for_fix_llm
from app.services.llm_usage_service import get_llm_response_text, log_llm_usage


logger = logging.getLogger(__name__)

_CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,}", re.IGNORECASE)
_HIGH_SEVERITIES = {"HIGH", "CRITICAL"}


@dataclass(frozen=True)
class VerifyResult:
    passed: bool
    stage: str
    retries: int = 0
    reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "stage": self.stage,
            "retries": self.retries,
            "reason": self.reason,
        }


def extract_cve_ids(text: str | None) -> set[str]:
    if not text:
        return set()
    return {match.upper() for match in _CVE_PATTERN.findall(text)}


def _collect_fix_text_parts(fix: dict[str, Any]) -> list[str]:
    parts: list[str] = []
    for key in ("summary", "codeGuidance", "verification"):
        value = fix.get(key)
        if isinstance(value, str):
            parts.append(value)
    for key in ("recommendedActions", "cautions"):
        values = fix.get(key) or []
        if isinstance(values, list):
            parts.extend(str(value) for value in values if isinstance(value, str))
    patches = fix.get("patches") or []
    if isinstance(patches, list):
        for patch in patches:
            if isinstance(patch, dict):
                for key in ("oldText", "newText"):
                    value = patch.get(key)
                    if isinstance(value, str):
                        parts.append(value)
    return parts


def rule_based_verify(
    finding: dict[str, Any],
    fix: dict[str, Any],
) -> VerifyResult:
    finding_text = " ".join(
        str(value)
        for value in (finding.get("ruleId"), finding.get("title"))
        if isinstance(value, str)
    )
    finding_cves = extract_cve_ids(finding_text)
    if finding_cves:
        fix_cves = extract_cve_ids(" ".join(_collect_fix_text_parts(fix)))
        if fix_cves and not (fix_cves & finding_cves):
            return VerifyResult(
                passed=False,
                stage="rule",
                reason=(
                    "fix가 finding과 다른 CVE를 언급함. "
                    f"finding: {sorted(finding_cves)}, fix: {sorted(fix_cves)}"
                ),
            )

    scan_type = finding.get("scanType")
    source = finding.get("source")
    is_server_audit = scan_type == "SERVER_AUDIT" or source == "server-audit"
    if is_server_audit and (fix.get("patches") or fix.get("patch")):
        return VerifyResult(
            passed=False,
            stage="rule",
            reason="server-audit finding은 patches 없이 operational guidance만 제공해야 함.",
        )

    return VerifyResult(passed=True, stage="rule")


def should_run_llm_verify(finding: dict[str, Any], fix: dict[str, Any]) -> bool:
    if not VERIFY_LLM_ENABLED:
        return False
    severity = (finding.get("severity") or "").upper()
    if severity not in _HIGH_SEVERITIES:
        return False
    return bool(fix.get("patches"))


def _parse_verify_response(response_text: str) -> dict[str, Any]:
    normalized = response_text.strip()
    if normalized.startswith("```"):
        lines = normalized.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        normalized = "\n".join(lines).strip()

    if not normalized:
        raise ValueError("Verify response is empty.")

    parsed = json.loads(normalized)
    if not isinstance(parsed, dict):
        raise ValueError("Verify response must be a JSON object.")

    passed = parsed.get("passed")
    if not isinstance(passed, bool):
        raise ValueError("Verify response field 'passed' must be a boolean.")

    reason = parsed.get("reason")
    if reason is not None and not isinstance(reason, str):
        raise ValueError("Verify response field 'reason' must be a string when present.")

    return {"passed": passed, "reason": reason}


def llm_verify(
    finding: dict[str, Any],
    fix: dict[str, Any],
) -> VerifyResult:
    from app.chains.verify_chain import create_verify_chain

    chain = create_verify_chain()
    finding_input = format_finding_for_fix_llm(finding)
    fix_input = json.dumps(fix, ensure_ascii=False)
    finding_id = finding.get("id")

    raw_response = invoke_llm_with_retry(
        chain,
        {"finding_input": finding_input, "fix_input": fix_input},
    )
    raw_text = get_llm_response_text(raw_response)
    log_llm_usage(
        logger=logger,
        stage="VERIFY",
        finding_id=finding_id if isinstance(finding_id, str) else None,
        input_text=finding_input + "\n" + fix_input,
        response=raw_response,
        attempt_count=1,
        max_output_tokens=LLM_VERIFY_MAX_TOKENS,
    )

    try:
        parsed = _parse_verify_response(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning(
            "Verify LLM parse failed; treating as passed. findingId=%s error=%s raw=%r",
            finding_id,
            exc,
            raw_text,
        )
        return VerifyResult(
            passed=True,
            stage="llm_parse_failed",
            reason=None,
        )

    return VerifyResult(
        passed=parsed["passed"],
        stage="llm",
        reason=parsed["reason"] if not parsed["passed"] else None,
    )


def verify_once(
    finding: dict[str, Any],
    fix: dict[str, Any],
) -> VerifyResult:
    rule_result = rule_based_verify(finding, fix)
    if not rule_result.passed:
        return rule_result
    if should_run_llm_verify(finding, fix):
        return llm_verify(finding, fix)
    return rule_result


def _apply_scan_type_postprocess(
    finding: dict[str, Any],
    fix: dict[str, Any],
) -> dict[str, Any]:
    if finding.get("scanType") == "SERVER_AUDIT":
        fix.pop("patch", None)
        fix.pop("patches", None)
    return fix


def _regenerate_fix_with_feedback(
    finding: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    from app.chains.fix_chain import create_fix_chain
    from app.services.fix_service import build_fix_retry_prompt, parse_fix_response

    chain = create_fix_chain()
    finding_input = format_finding_for_fix_llm(finding)
    prompt_input = build_fix_retry_prompt(
        finding_input=finding_input,
        error_message=reason,
    )
    finding_id = finding.get("id")
    raw_response = invoke_llm_with_retry(chain, {"finding_input": prompt_input})
    raw_fix = get_llm_response_text(raw_response)
    log_llm_usage(
        logger=logger,
        stage="VERIFY_REGEN",
        finding_id=finding_id if isinstance(finding_id, str) else None,
        input_text=prompt_input,
        response=raw_response,
        attempt_count=1,
        max_output_tokens=LLM_FIX_MAX_TOKENS,
    )
    return parse_fix_response(raw_fix)


def verify_and_maybe_regenerate(
    finding: dict[str, Any],
    fix: dict[str, Any],
) -> tuple[dict[str, Any], VerifyResult]:
    if not VERIFY_ENABLED:
        return fix, VerifyResult(passed=True, stage="skipped")

    result = verify_once(finding, fix)
    if result.passed:
        return fix, result

    finding_id = finding.get("id")
    for attempt in range(1, MAX_VERIFY_RETRIES + 1):
        try:
            new_fix = _regenerate_fix_with_feedback(
                finding,
                result.reason or "verify 검증 실패",
            )
            new_fix = _apply_scan_type_postprocess(finding, new_fix)
        except Exception as exc:
            logger.warning(
                "Verify regen failed. findingId=%s attempt=%d error=%s",
                finding_id,
                attempt,
                exc,
            )
            return fix, replace(result, retries=attempt)

        fix = new_fix
        result = verify_once(finding, fix)
        result = replace(result, retries=attempt)
        if result.passed:
            return fix, result

    return fix, result
