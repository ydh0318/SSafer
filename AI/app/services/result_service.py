import json
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


ANALYSIS_RESULT_SCHEMA_VERSION = "0.1"
DEFAULT_ANALYSIS_RESULT_PATH = "data/analysis_result.json"
REQUIRED_ANALYSIS_RESULT_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "generatedAt",
    "resultCount",
    "results",
)
REQUIRED_ANALYSIS_RESULT_STRING_FIELDS = (
    "schemaVersion",
    "scanId",
    "source",
    "scannedAt",
    "generatedAt",
)
REQUIRED_RESULT_FIELDS = (
    "findingId",
    "ruleId",
    "source",
    "severity",
    "file",
    "line",
    "title",
    "maskedEvidence",
    "explanation",
    "impact",
    "fix",
)
REQUIRED_RESULT_STRING_FIELDS = (
    "findingId",
    "ruleId",
    "source",
    "severity",
    "file",
    "title",
    "maskedEvidence",
    "impact",
)
REQUIRED_EXPLANATION_FIELDS = (
    "summary",
    "whyRisky",
    "abuseScenario",
    "expectedImpact",
    "severityInterpretation",
)
REQUIRED_FIX_FIELDS = (
    "summary",
    "priority",
    "recommendedActions",
    "codeGuidance",
    "verification",
    "cautions",
)
REQUIRED_FIX_STRING_FIELDS = (
    "summary",
    "priority",
    "codeGuidance",
    "verification",
)
ALLOWED_FIX_PRIORITIES = ("critical", "high", "medium", "low")
REQUIRED_FIX_PATCH_FIELDS = (
    "patchId",
    "findingId",
    "filePath",
    "operation",
    "newText",
    "expectedFileHash",
)
REQUIRED_FIX_PATCH_STRING_FIELDS = (
    "patchId",
    "findingId",
    "filePath",
    "operation",
    "expectedFileHash",
)
REPLACE_FIX_PATCH_FIELDS = (
    "oldText",
)
REPLACE_FIX_PATCH_STRING_FIELDS = (
    "oldText",
)
ALLOWED_FIX_PATCH_OPERATIONS = ("replace", "append")
ALLOWED_FIX_PATCH_ROLLBACK_OPERATIONS = ("replace",)
DISALLOWED_PATCH_TEXT_TOKENS = (
    "***MASKED***",
    "[MASKED]",
    "<MASKED>",
)
REQUIRED_FIX_PATCH_ROLLBACK_FIELDS = (
    "operation",
    "oldText",
    "newText",
)
REQUIRED_FIX_PATCH_ROLLBACK_STRING_FIELDS = (
    "operation",
    "oldText",
    "newText",
)


def _resolve_path(path: str) -> Path:
    resolved_path = Path(path)
    if not resolved_path.is_absolute():
        resolved_path = Path.cwd() / resolved_path
    return resolved_path


def _is_iso8601_datetime(value: str) -> bool:
    if "T" not in value:
        return False

    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError:
        return False
    return True


def _map_ai_results_by_finding_id(
    ai_results: list[dict[str, Any]],
    value_key: str,
) -> dict[str, Any]:
    mapped_results: dict[str, Any] = {}

    for ai_result in ai_results:
        finding_id = ai_result.get("finding_id")
        if not isinstance(finding_id, str) or not finding_id.strip():
            raise ValueError("AI result must contain a non-empty finding_id.")

        if finding_id in mapped_results:
            raise ValueError(f"Duplicate AI result for finding_id: {finding_id}")

        if value_key not in ai_result:
            raise ValueError(
                f"AI result for finding_id={finding_id} missing {value_key}."
            )

        mapped_results[finding_id] = ai_result[value_key]

    return mapped_results


def build_structured_analysis_result(
    finding: dict[str, Any],
    explanation: str | dict[str, Any],
    fix: dict[str, Any],
) -> dict[str, Any]:
    explanation_sections, impact_text = normalize_explanation_payload(explanation)
    result = {
        "findingId": finding["id"],
        "ruleId": finding["ruleId"],
        "source": finding["source"],
        "severity": finding["severity"],
        "file": finding["file"],
        "line": finding["line"],
        "title": finding["title"],
        "maskedEvidence": finding["maskedEvidence"],
        "explanation": explanation_sections,
        "impact": impact_text,
        "fix": fix,
    }
    if finding.get("filePath"):
        result["filePath"] = finding["filePath"]
    if finding.get("targetFiles"):
        result["targetFiles"] = finding["targetFiles"]
    if finding.get("target"):
        result["target"] = finding["target"]
    if finding.get("evidence"):
        result["evidence"] = finding["evidence"]
    return result


def normalize_explanation_payload(
    explanation: str | dict[str, Any],
) -> tuple[dict[str, str], str]:
    if isinstance(explanation, dict):
        explanation_sections = explanation.get("explanation")
        impact_text = explanation.get("impact")
        if isinstance(explanation_sections, str) and explanation_sections.strip():
            explanation_sections = _legacy_explanation_sections(explanation_sections)
        validate_explanation_sections(explanation_sections, "explanation")
        if isinstance(impact_text, str) and impact_text.strip():
            return explanation_sections, impact_text
        raise ValueError(
            "Explanation result must include non-empty explanation and impact."
        )

    if isinstance(explanation, str) and explanation.strip():
        return _legacy_explanation_sections(explanation), explanation

    raise ValueError("Explanation result must be a non-empty string or object.")


def _legacy_explanation_sections(explanation: str) -> dict[str, str]:
    return {
        field: explanation
        for field in REQUIRED_EXPLANATION_FIELDS
    }


def validate_explanation_sections(explanation: Any, path: str) -> None:
    if not isinstance(explanation, dict):
        raise ValueError(f"{path} must be an object.")

    missing_fields = [
        field for field in REQUIRED_EXPLANATION_FIELDS if field not in explanation
    ]
    if missing_fields:
        raise ValueError(
            f"{path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_EXPLANATION_FIELDS:
        value = explanation[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}.{field} must be a non-empty string.")


def build_structured_analysis_results(
    findings: list[dict[str, Any]],
    explanations: list[str],
    fixes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if len(findings) != len(explanations) or len(findings) != len(fixes):
        raise ValueError("findings, explanations, and fixes must have the same length.")

    return [
        build_structured_analysis_result(finding, explanation, fix)
        for finding, explanation, fix in zip(findings, explanations, fixes)
    ]


def build_structured_analysis_results_by_finding_id(
    findings: list[dict[str, Any]],
    explanation_results: list[dict[str, Any]],
    fix_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    explanation_by_finding_id = _map_ai_results_by_finding_id(
        explanation_results,
        "explanation",
    )
    fix_by_finding_id = _map_ai_results_by_finding_id(fix_results, "fix")

    structured_results: list[dict[str, Any]] = []
    for finding in findings:
        finding_id = finding["id"]

        if finding_id not in explanation_by_finding_id:
            raise ValueError(f"Missing explanation for finding_id: {finding_id}")

        if finding_id not in fix_by_finding_id:
            raise ValueError(f"Missing fix for finding_id: {finding_id}")

        structured_results.append(
            build_structured_analysis_result(
                finding=finding,
                explanation=explanation_by_finding_id[finding_id],
                fix=fix_by_finding_id[finding_id],
            )
        )

    return structured_results


def build_analysis_result(
    scan_result: dict[str, Any],
    findings: list[dict[str, Any]],
    explanation_results: list[dict[str, Any]],
    fix_results: list[dict[str, Any]],
) -> dict[str, Any]:
    results = build_structured_analysis_results_by_finding_id(
        findings=findings,
        explanation_results=explanation_results,
        fix_results=fix_results,
    )

    analysis_result = {
        "schemaVersion": ANALYSIS_RESULT_SCHEMA_VERSION,
        "scanId": scan_result.get("scanId"),
        "source": scan_result.get("source"),
        "scannedAt": scan_result.get("scannedAt"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": len(results),
        "results": results,
    }
    normalize_analysis_result_patches(
        findings=findings,
        scan_result=scan_result,
        analysis_result=analysis_result,
    )
    return analysis_result


def build_analysis_result_from_results(
    scan_result: dict[str, Any],
    structured_results: list[dict[str, Any]],
) -> dict[str, Any]:
    analysis_result = {
        "schemaVersion": ANALYSIS_RESULT_SCHEMA_VERSION,
        "scanId": scan_result.get("scanId"),
        "source": scan_result.get("source"),
        "scannedAt": scan_result.get("scannedAt"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "resultCount": len(structured_results),
        "results": structured_results,
    }
    if scan_result.get("auditId"):
        analysis_result["auditId"] = scan_result.get("auditId")
    return analysis_result


def normalize_analysis_result_patches(
    *,
    findings: list[dict[str, Any]],
    scan_result: dict[str, Any],
    analysis_result: dict[str, Any],
) -> None:
    findings_by_id = {
        finding["id"]: finding
        for finding in findings
        if isinstance(finding.get("id"), str)
    }
    source_hashes = scan_result.get("sourceFileHashes") or {}
    content_by_target = _artifact_text_content_by_target(scan_result)
    for result in analysis_result.get("results") or []:
        if not isinstance(result, dict):
            continue
        finding = findings_by_id.get(result.get("findingId"))
        fix = result.get("fix")
        if finding is None or not isinstance(fix, dict):
            continue
        patch_candidates = fix.get("patches")
        if not patch_candidates:
            continue

        normalized_patches: list[dict[str, Any]] = []
        for patch in patch_candidates:
            normalized_patch = normalize_fix_patch_for_finding(
                patch=patch,
                finding=finding,
                source_hashes=source_hashes,
                content_by_target=content_by_target,
            )
            if normalized_patch is not None:
                normalized_patches.append(normalized_patch)

        normalized_patches = _dedupe_patches(normalized_patches)

        if normalized_patches:
            fix["patches"] = normalized_patches
        else:
            fix.pop("patches", None)


def _dedupe_patches(patches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, str, str]] = set()
    for patch in patches:
        key = (
            str(patch.get("patchId") or ""),
            str(patch.get("findingId") or ""),
            str(patch.get("filePath") or ""),
            str(patch.get("operation") or ""),
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(patch)
    return deduped


def normalize_fix_patch_for_finding(
    *,
    patch: Any,
    finding: dict[str, Any],
    source_hashes: dict[str, str],
    content_by_target: dict[str, str],
) -> dict[str, Any] | None:
    if not isinstance(patch, dict):
        return None

    patch_context = finding.get("patchContext")
    if not isinstance(patch_context, dict):
        return None

    expected_file_hash = patch_context.get("expectedFileHash")
    if not isinstance(expected_file_hash, str) or not expected_file_hash.startswith("sha256:"):
        return None

    normalized_patch = dict(patch)
    legacy_target_file = normalized_patch.pop("targetFile", None)
    if not normalized_patch.get("filePath") and legacy_target_file:
        normalized_patch["filePath"] = legacy_target_file

    context_operation = patch_context.get("operation")
    operation = (
        context_operation
        if isinstance(context_operation, str) and context_operation
        else normalized_patch.get("operation")
    )
    if operation not in ALLOWED_FIX_PATCH_OPERATIONS:
        return None
    normalized_patch["operation"] = operation

    file_path = _patch_context_file_path(
        finding=finding,
        patch_file_path=normalized_patch.get("filePath"),
        old_text=patch_context.get("oldText"),
        content_by_target=content_by_target,
    )
    if file_path is None:
        return None

    source_file_hash = source_hashes.get(file_path)
    if source_file_hash is not None and source_file_hash != expected_file_hash:
        return None

    old_text = patch_context.get("oldText")
    if operation == "replace":
        if not isinstance(old_text, str) or not old_text:
            return None
        target_content = content_by_target.get(file_path)
        if target_content is not None and target_content.count(old_text) != 1:
            return None
        normalized_patch["oldText"] = old_text
    else:
        normalized_patch.pop("oldText", None)

    finding_id = finding.get("id")
    if isinstance(finding_id, str) and finding_id.strip():
        normalized_patch["findingId"] = finding_id
        normalized_patch.setdefault("patchId", f"PATCH-{finding_id}")
    normalized_patch["filePath"] = file_path
    normalized_patch["expectedFileHash"] = expected_file_hash
    if "requiresApproval" in normalized_patch:
        normalized_patch["requiresApproval"] = True
    return normalized_patch


def _patch_context_file_path(
    *,
    finding: dict[str, Any],
    patch_file_path: Any,
    old_text: Any,
    content_by_target: dict[str, str],
) -> str | None:
    finding_file_path = finding.get("filePath")
    if isinstance(finding_file_path, str) and finding_file_path.strip():
        if (
            isinstance(patch_file_path, str)
            and patch_file_path.strip()
            and patch_file_path != finding_file_path
        ):
            return None
        return finding_file_path

    target_files = finding.get("targetFiles")
    if (
        not isinstance(old_text, str)
        or not old_text
        or not isinstance(target_files, list)
        or not target_files
    ):
        return None

    matched_targets: list[str] = []
    for target in target_files:
        if not isinstance(target, str) or not target.strip():
            continue
        if isinstance(patch_file_path, str) and patch_file_path.strip() and patch_file_path != target:
            continue
        target_content = content_by_target.get(target)
        if target_content is None:
            continue
        if target_content.count(old_text) == 1:
            matched_targets.append(target)

    if len(matched_targets) != 1:
        return None

    return matched_targets[0]

def _artifact_text_content_by_target(scan_result: dict[str, Any]) -> dict[str, str]:
    content_by_target: dict[str, str] = {}
    artifacts = scan_result.get("artifacts")
    if not isinstance(artifacts, list):
        return content_by_target

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        target = artifact.get("target")
        content = artifact.get("content")
        if isinstance(target, str) and isinstance(content, str):
            content_by_target[target] = content
    return content_by_target


def _collect_unique_ids(
    items: list[dict[str, Any]],
    key: str,
    path: str,
) -> list[str]:
    ids: list[str] = []
    seen_ids: set[str] = set()

    for index, item in enumerate(items):
        value = item.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}[{index}].{key} must be a non-empty string.")

        if value in seen_ids:
            raise ValueError(f"Duplicate {key}: {value}")

        seen_ids.add(value)
        ids.append(value)

    return ids


def validate_finding_id_mapping(
    findings: list[dict[str, Any]],
    analysis_result: dict[str, Any],
) -> None:
    validate_analysis_result(analysis_result)

    input_finding_ids = _collect_unique_ids(findings, "id", "findings")
    output_finding_ids = _collect_unique_ids(
        analysis_result["results"],
        "findingId",
        "analysis_result.results",
    )

    input_finding_id_set = set(input_finding_ids)
    output_finding_id_set = set(output_finding_ids)
    missing_ids = sorted(input_finding_id_set - output_finding_id_set)
    extra_ids = sorted(output_finding_id_set - input_finding_id_set)

    if missing_ids or extra_ids:
        details: list[str] = []
        if missing_ids:
            details.append(f"missing output findingId: {', '.join(missing_ids)}")
        if extra_ids:
            details.append(f"unexpected output findingId: {', '.join(extra_ids)}")
        raise ValueError(
            "analysis_result findingId mapping must match input findings: "
            + "; ".join(details)
        )


def validate_analysis_result(analysis_result: dict[str, Any]) -> None:
    missing_fields = [
        field
        for field in REQUIRED_ANALYSIS_RESULT_FIELDS
        if field not in analysis_result
    ]
    if missing_fields:
        raise ValueError(
            "analysis_result.json missing required fields: "
            f"{', '.join(missing_fields)}"
        )

    for field in REQUIRED_ANALYSIS_RESULT_STRING_FIELDS:
        value = analysis_result[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"analysis_result.{field} must be a non-empty string."
            )

    if analysis_result["schemaVersion"] != ANALYSIS_RESULT_SCHEMA_VERSION:
        raise ValueError(
            "analysis_result.schemaVersion must be "
            f"{ANALYSIS_RESULT_SCHEMA_VERSION}."
        )

    for field in ("scannedAt", "generatedAt"):
        if not _is_iso8601_datetime(analysis_result[field]):
            raise ValueError(
                f"analysis_result.{field} must be an ISO 8601 datetime."
            )

    result_count = analysis_result.get("resultCount")
    results = analysis_result.get("results")

    if type(result_count) is not int:
        raise ValueError("analysis_result.resultCount must be an integer.")
    if result_count < 0:
        raise ValueError("analysis_result.resultCount must be greater than or equal to 0.")

    if not isinstance(results, list):
        raise ValueError("analysis_result.results must be an array.")

    if result_count != len(results):
        raise ValueError("analysis_result.resultCount must match results length.")

    seen_finding_ids: set[str] = set()
    for index, result in enumerate(results):
        validate_analysis_result_item(result, index)
        finding_id = result["findingId"]
        if finding_id in seen_finding_ids:
            raise ValueError(f"Duplicate findingId in analysis_result: {finding_id}")
        seen_finding_ids.add(finding_id)


def validate_analysis_result_item(result: Any, index: int) -> None:
    result_path = f"analysis_result.results[{index}]"

    if not isinstance(result, dict):
        raise ValueError(f"{result_path} must be an object.")

    missing_fields = [field for field in REQUIRED_RESULT_FIELDS if field not in result]
    if missing_fields:
        raise ValueError(
            f"{result_path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_RESULT_STRING_FIELDS:
        value = result[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"{result_path}.{field} must be a non-empty string."
            )

    line = result["line"]
    if line is not None and type(line) is not int:
        raise ValueError(f"{result_path}.line must be an integer or null.")

    validate_explanation_sections(result["explanation"], f"{result_path}.explanation")
    validate_fix_schema(result["fix"], f"{result_path}.fix")


def validate_fix_schema(
    fix: Any,
    path: str = "fix",
    strict_patch_metadata: bool = True,
) -> None:
    if not isinstance(fix, dict):
        raise ValueError(f"{path} must be an object.")

    missing_fields = [field for field in REQUIRED_FIX_FIELDS if field not in fix]
    if missing_fields:
        raise ValueError(
            f"{path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_FIX_STRING_FIELDS:
        value = fix[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}.{field} must be a non-empty string.")

    priority = fix["priority"]
    if priority not in ALLOWED_FIX_PRIORITIES:
        raise ValueError(
            f"{path}.priority must be one of: "
            f"{', '.join(ALLOWED_FIX_PRIORITIES)}."
        )

    recommended_actions = fix["recommendedActions"]
    if not isinstance(recommended_actions, list):
        raise ValueError(f"{path}.recommendedActions must be an array.")
    if not 2 <= len(recommended_actions) <= 5:
        raise ValueError(f"{path}.recommendedActions must contain 2 to 5 items.")

    cautions = fix["cautions"]
    if not isinstance(cautions, list):
        raise ValueError(f"{path}.cautions must be an array.")
    if len(cautions) > 3:
        raise ValueError(f"{path}.cautions must contain 0 to 3 items.")

    for field, values in (
        ("recommendedActions", recommended_actions),
        ("cautions", cautions),
    ):
        for item_index, value in enumerate(values):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(
                    f"{path}.{field}[{item_index}] must be a non-empty string."
                )

    if "patches" in fix:
        validate_fix_patches_schema(
            fix["patches"],
            f"{path}.patches",
            strict_patch_metadata=strict_patch_metadata,
        )


def validate_fix_patches_schema(
    patches: Any,
    path: str = "fix.patches",
    strict_patch_metadata: bool = True,
) -> None:
    if not isinstance(patches, list):
        raise ValueError(f"{path} must be an array.")
    if not patches:
        raise ValueError(f"{path} must contain at least 1 item.")

    for index, patch in enumerate(patches):
        validate_fix_patch_schema(
            patch,
            f"{path}[{index}]",
            strict_patch_metadata=strict_patch_metadata,
        )


def validate_fix_patch_schema(
    patch: Any,
    path: str = "fix.patches[]",
    strict_patch_metadata: bool = True,
) -> None:
    if not isinstance(patch, dict):
        raise ValueError(f"{path} must be an object.")
    if "filePath" not in patch and "targetFile" in patch:
        patch["filePath"] = patch.pop("targetFile")
    else:
        patch.pop("targetFile", None)

    if strict_patch_metadata:
        required_fields = REQUIRED_FIX_PATCH_FIELDS
        required_string_fields = REQUIRED_FIX_PATCH_STRING_FIELDS
    else:
        required_fields = ("operation", "newText")
        required_string_fields = ("operation",)

    missing_fields = [field for field in required_fields if field not in patch]
    if missing_fields:
        raise ValueError(
            f"{path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in required_string_fields:
        value = patch[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}.{field} must be a non-empty string.")

    if not isinstance(patch["newText"], str):
        raise ValueError(f"{path}.newText must be a string.")

    if "filePath" in patch:
        validate_patch_target_file(patch["filePath"], f"{path}.filePath")
    validate_patch_text_safety(patch["newText"], f"{path}.newText")

    operation = patch["operation"]
    if operation not in ALLOWED_FIX_PATCH_OPERATIONS:
        raise ValueError(
            f"{path}.operation must be one of: "
            f"{', '.join(ALLOWED_FIX_PATCH_OPERATIONS)}."
        )

    if operation == "replace":
        missing_replace_fields = [
            field for field in REPLACE_FIX_PATCH_FIELDS if field not in patch
        ]
        if missing_replace_fields:
            raise ValueError(
                f"{path} missing required fields: {', '.join(missing_replace_fields)}"
            )
        for field in REPLACE_FIX_PATCH_STRING_FIELDS:
            value = patch[field]
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{path}.{field} must be a non-empty string.")
        validate_patch_replacement_text(
            old_text=patch["oldText"],
            new_text=patch["newText"],
            path=path,
        )
    elif "oldText" in patch:
        value = patch["oldText"]
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ValueError(f"{path}.oldText must be a non-empty string when provided.")

    expected_file_hash = patch.get("expectedFileHash")
    if expected_file_hash is not None and not expected_file_hash.startswith("sha256:"):
        raise ValueError(f"{path}.expectedFileHash must start with sha256:.")

    if "requiresApproval" in patch and patch["requiresApproval"] is not True:
        raise ValueError(f"{path}.requiresApproval must be true.")

    if "rollback" in patch:
        validate_fix_patch_rollback_schema(patch["rollback"], f"{path}.rollback")


def validate_fix_patch_rollback_schema(
    rollback: Any,
    path: str = "fix.patches[].rollback",
) -> None:
    if not isinstance(rollback, dict):
        raise ValueError(f"{path} must be an object.")

    missing_fields = [
        field for field in REQUIRED_FIX_PATCH_ROLLBACK_FIELDS if field not in rollback
    ]
    if missing_fields:
        raise ValueError(
            f"{path} missing required fields: {', '.join(missing_fields)}"
        )

    for field in REQUIRED_FIX_PATCH_ROLLBACK_STRING_FIELDS:
        value = rollback[field]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}.{field} must be a non-empty string.")

    operation = rollback["operation"]
    if operation not in ALLOWED_FIX_PATCH_ROLLBACK_OPERATIONS:
        raise ValueError(
            f"{path}.operation must be one of: "
            f"{', '.join(ALLOWED_FIX_PATCH_ROLLBACK_OPERATIONS)}."
        )


def validate_patch_target_file(target_file: str, path: str) -> None:
    if target_file.startswith(("/", "~")):
        raise ValueError(f"{path} must be a repository-relative path.")
    if "\\" in target_file:
        raise ValueError(f"{path} must use forward slashes.")

    parsed_path = PurePosixPath(target_file)
    if parsed_path.is_absolute() or ".." in parsed_path.parts:
        raise ValueError(f"{path} must be a repository-relative path.")


def validate_patch_replacement_text(
    *,
    old_text: str,
    new_text: str,
    path: str,
) -> None:
    if old_text == new_text:
        raise ValueError(f"{path}.oldText and {path}.newText must be different.")

    validate_patch_text_safety(old_text, f"{path}.oldText")
    validate_patch_text_safety(new_text, f"{path}.newText")


def validate_patch_text_safety(text: str, path: str) -> None:
    for token in DISALLOWED_PATCH_TEXT_TOKENS:
        if token in text:
            raise ValueError(f"{path} must not contain masked values.")


def save_analysis_result(
    analysis_result: dict[str, Any],
    output_path: str = DEFAULT_ANALYSIS_RESULT_PATH,
) -> Path:
    validate_analysis_result(analysis_result)

    path = _resolve_path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(analysis_result, file, ensure_ascii=False, indent=2)
        file.write("\n")

    return path


def load_analysis_result(output_path: str = DEFAULT_ANALYSIS_RESULT_PATH) -> dict[str, Any]:
    path = _resolve_path(output_path)

    try:
        with path.open("r", encoding="utf-8-sig") as file:
            analysis_result = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid analysis_result.json file: {path}") from exc

    if not isinstance(analysis_result, dict):
        raise ValueError("analysis_result.json root must be a JSON object.")

    validate_analysis_result(analysis_result)
    return analysis_result
