from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from ssafer.core.hashing import hash_file


class PatchError(RuntimeError):
    pass


@dataclass(frozen=True)
class PatchCandidate:
    patch_id: str
    finding_id: str | None
    file_path: str
    operation: str
    old_text: str | None
    new_text: str
    expected_file_hash: str | None = None


@dataclass(frozen=True)
class PatchApplyResult:
    patch_id: str
    finding_id: str | None
    file_path: str
    status: str
    message: str
    backup_path: str | None = None


def find_default_analysis_result(project_root: Path) -> Path | None:
    candidates = [
        project_root / ".ssafer" / "analysis_result.json",
        project_root / ".ssafer" / "analysis" / "analysis_result.json",
        project_root / ".ssafer" / "results" / "analysis_result.json",
        project_root / "analysis_result.json",
        project_root / "AI" / "data" / "analysis_result.json",
    ]
    discovered = [
        *[candidate for candidate in candidates if candidate.exists()],
        *_iter_analysis_result_candidates(project_root),
    ]
    unique = list(dict.fromkeys(discovered))
    if not unique:
        return None
    return max(unique, key=lambda path: path.stat().st_mtime)


def load_patch_candidates_from_file(path: Path) -> list[PatchCandidate]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return extract_patch_candidates(payload)


def _iter_analysis_result_candidates(project_root: Path) -> list[Path]:
    ignored_dirs = {
        ".git",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".tox",
        ".venv",
        "build",
        "dist",
        "node_modules",
        "venv",
    }
    candidates: list[Path] = []
    for path in project_root.rglob("analysis_result*.json"):
        if any(part in ignored_dirs for part in path.relative_to(project_root).parts):
            continue
        if path.is_file():
            candidates.append(path)
    return candidates


def extract_patch_candidates(payload: dict[str, Any]) -> list[PatchCandidate]:
    candidates: list[PatchCandidate] = []
    for index, item in enumerate(_iter_patch_items(payload), start=1):
        candidate = _build_candidate(item, index)
        if candidate is not None:
            candidates.append(candidate)
    return candidates


def apply_patch_candidate(
    project_root: Path,
    candidate: PatchCandidate,
    *,
    dry_run: bool = False,
    allow_hash_mismatch_if_text_matches: bool = False,
) -> PatchApplyResult:
    return _apply_patch_candidate(
        project_root,
        candidate,
        dry_run=dry_run,
        verify_hash=True,
        allow_hash_mismatch_if_text_matches=allow_hash_mismatch_if_text_matches,
    )


def _apply_patch_candidate(
    project_root: Path,
    candidate: PatchCandidate,
    *,
    dry_run: bool = False,
    verify_hash: bool = True,
    allow_hash_mismatch_if_text_matches: bool = False,
) -> PatchApplyResult:
    root = project_root.resolve()
    target = _resolve_target_path(root, candidate.file_path)
    if not target.exists() or not target.is_file():
        raise PatchError(f"Target file not found: {candidate.file_path}")

    if verify_hash:
        _validate_expected_hash(
            target,
            candidate,
            allow_hash_mismatch_if_text_matches=allow_hash_mismatch_if_text_matches,
        )

    if candidate.operation == "replace":
        return _apply_replace_patch(root, target, candidate, dry_run=dry_run)
    if candidate.operation == "append":
        return _apply_append_patch(root, target, candidate, dry_run=dry_run)
    else:
        raise PatchError(f"Unsupported patch operation: {candidate.operation}")


def _apply_replace_patch(
    root: Path,
    target: Path,
    candidate: PatchCandidate,
    *,
    dry_run: bool,
) -> PatchApplyResult:
    if candidate.old_text is None:
        raise PatchError(f"Patch oldText is required for replace operation: {candidate.file_path}")

    content = target.read_text(encoding="utf-8")
    occurrences = content.count(candidate.old_text)
    if occurrences == 0:
        raise PatchError(f"Patch oldText was not found: {candidate.file_path}")
    if occurrences > 1:
        raise PatchError(f"Patch oldText matched multiple locations: {candidate.file_path}")

    if dry_run:
        return PatchApplyResult(
            patch_id=candidate.patch_id,
            finding_id=candidate.finding_id,
            file_path=candidate.file_path,
            status="DRY_RUN",
            message="Patch can be applied.",
        )

    backup_path = _write_backup(root, target)
    target.write_text(content.replace(candidate.old_text, candidate.new_text, 1), encoding="utf-8")
    return PatchApplyResult(
        patch_id=candidate.patch_id,
        finding_id=candidate.finding_id,
        file_path=candidate.file_path,
        status="SUCCESS",
        message="Patch applied successfully.",
        backup_path=str(backup_path),
    )


def _apply_append_patch(
    root: Path,
    target: Path,
    candidate: PatchCandidate,
    *,
    dry_run: bool,
) -> PatchApplyResult:
    content = target.read_text(encoding="utf-8")
    if dry_run:
        return PatchApplyResult(
            patch_id=candidate.patch_id,
            finding_id=candidate.finding_id,
            file_path=candidate.file_path,
            status="DRY_RUN",
            message="Patch can be appended.",
        )

    backup_path = _write_backup(root, target)
    target.write_text(content + candidate.new_text, encoding="utf-8")
    return PatchApplyResult(
        patch_id=candidate.patch_id,
        finding_id=candidate.finding_id,
        file_path=candidate.file_path,
        status="SUCCESS",
        message="Patch appended successfully.",
        backup_path=str(backup_path),
    )


def apply_patch_candidates(
    project_root: Path,
    candidates: list[PatchCandidate],
    *,
    patch_id: str | None = None,
    dry_run: bool = False,
    allow_hash_mismatch_if_text_matches: bool = False,
) -> list[PatchApplyResult]:
    selected = [candidate for candidate in candidates if patch_id is None or candidate.patch_id == patch_id]
    if patch_id is not None and not selected:
        raise PatchError(f"Patch not found: {patch_id}")
    root = project_root.resolve()
    for candidate in selected:
        target = _resolve_target_path(root, candidate.file_path)
        if not target.exists() or not target.is_file():
            raise PatchError(f"Target file not found: {candidate.file_path}")
        _validate_expected_hash(
            target,
            candidate,
            allow_hash_mismatch_if_text_matches=allow_hash_mismatch_if_text_matches,
        )
    return [
        _apply_patch_candidate(project_root, candidate, dry_run=dry_run, verify_hash=False)
        for candidate in selected
    ]


def _iter_patch_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    patches = payload.get("patches")
    if isinstance(patches, list):
        items.extend(item for item in patches if isinstance(item, dict))

    results = payload.get("results")
    if isinstance(results, list):
        for result in results:
            if not isinstance(result, dict):
                continue
            direct_patch = result.get("patch")
            if isinstance(direct_patch, dict):
                items.append({**result, "patch": direct_patch})
                continue
            fix = result.get("fix")
            if isinstance(fix, dict) and isinstance(fix.get("patch"), dict):
                items.append({**result, "patch": fix["patch"]})
            if isinstance(fix, dict) and isinstance(fix.get("patches"), list):
                for patch in fix["patches"]:
                    if isinstance(patch, dict):
                        items.append({**result, **patch})
    return items


def _validate_expected_hash(
    target: Path,
    candidate: PatchCandidate,
    *,
    allow_hash_mismatch_if_text_matches: bool = False,
) -> None:
    if not candidate.expected_file_hash:
        return
    actual_hash = hash_file(target)
    if actual_hash == candidate.expected_file_hash:
        return
    if allow_hash_mismatch_if_text_matches and _old_text_matches_once(target, candidate):
        return
    raise PatchError(
        f"Target file hash mismatch: {candidate.file_path} "
        f"(expected {candidate.expected_file_hash}, actual {actual_hash})"
    )


def _old_text_matches_once(target: Path, candidate: PatchCandidate) -> bool:
    if candidate.operation != "replace" or candidate.old_text is None:
        return False
    content = target.read_text(encoding="utf-8")
    return content.count(candidate.old_text) == 1


def _build_candidate(item: dict[str, Any], index: int) -> PatchCandidate | None:
    patch = item.get("patch")
    if isinstance(patch, dict):
        source = {**item, **patch}
    else:
        source = item

    old_text = source.get("oldText")
    new_text = source.get("newText")
    file_path = source.get("filePath") or source.get("file") or source.get("path")
    operation = str(source.get("operation") or "replace").strip().lower()
    if not isinstance(new_text, str) or not isinstance(file_path, str):
        return None
    if operation == "replace" and not isinstance(old_text, str):
        return None
    if operation == "append" and old_text is not None and not isinstance(old_text, str):
        return None

    finding_id = source.get("findingId")
    patch_id = source.get("patchId") or source.get("id") or finding_id or f"PATCH-{index:04d}"
    expected_file_hash = source.get("expectedFileHash") or source.get("fileHash")

    return PatchCandidate(
        patch_id=str(patch_id),
        finding_id=str(finding_id) if finding_id is not None else None,
        file_path=file_path,
        operation=operation,
        old_text=old_text if isinstance(old_text, str) else None,
        new_text=new_text,
        expected_file_hash=str(expected_file_hash) if expected_file_hash else None,
    )


def _resolve_target_path(project_root: Path, file_path: str) -> Path:
    if Path(file_path).is_absolute():
        raise PatchError(f"Absolute patch paths are not allowed: {file_path}")
    target = (project_root / file_path).resolve()
    try:
        target.relative_to(project_root)
    except ValueError as exc:
        raise PatchError(f"Patch path escapes project root: {file_path}") from exc
    return target


def _write_backup(project_root: Path, target: Path) -> Path:
    relative = target.relative_to(project_root)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_name = "__".join(relative.parts) + f".{timestamp}.bak"
    backup_dir = project_root / ".ssafer" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / backup_name
    backup_path.write_bytes(target.read_bytes())
    return backup_path
