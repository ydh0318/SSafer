import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from langchain_core.output_parsers import StrOutputParser

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.core.config import ANTHROPIC_MODEL, GMS_MODEL  # noqa: E402
from app.core.llm_provider import create_llm_provider  # noqa: E402
from app.loaders.scan_loader import (  # noqa: E402
    extract_findings,
    load_scan_result,
    split_valid_invalid_findings,
    validate_scan_result_required_fields,
)
from app.prompts.explain_prompt import EXPLAIN_PROMPT  # noqa: E402
from app.prompts.fix_prompt import FIX_PROMPT  # noqa: E402
from app.services.explain_service import contains_disallowed_script  # noqa: E402
from app.services.fix_service import parse_fix_response  # noqa: E402
from app.services.input_service import format_finding_for_llm  # noqa: E402


DEFAULT_MODELS = ("ollama:llama3.2:3b", "ollama:qwen2.5:3b")
DEFAULT_OUTPUT_PATH = "data/model_comparison_result.json"


@dataclass(frozen=True)
class ModelTarget:
    provider: str
    model: str

    @property
    def name(self) -> str:
        return f"{self.provider}:{self.model}"


def _parse_model_target(value: str) -> ModelTarget:
    provider, separator, model = value.partition(":")
    if separator and provider in {"ollama", "anthropic", "gms"}:
        return ModelTarget(provider=provider, model=model)
    return ModelTarget(provider="ollama", model=value)


def _create_llm(target: ModelTarget, response_format: str | None = None) -> Any:
    provider = create_llm_provider(target.provider, model=target.model)
    return provider.create_chat_model(response_format=response_format)


def _load_valid_findings(scan_result_path: str, limit: int) -> list[dict[str, Any]]:
    scan_result = load_scan_result(scan_result_path)
    validate_scan_result_required_fields(scan_result)
    raw_findings = extract_findings(scan_result)
    valid_findings, invalid_findings = split_valid_invalid_findings(raw_findings)

    if invalid_findings:
        print(f"Skipping invalid findings: {len(invalid_findings)}")

    return valid_findings[:limit]


def _elapsed_ms(started_at: float) -> int:
    return int((time.perf_counter() - started_at) * 1000)


def _evaluate_explanation(target: ModelTarget, finding: dict[str, Any]) -> dict[str, Any]:
    chain = EXPLAIN_PROMPT | _create_llm(target) | StrOutputParser()
    started_at = time.perf_counter()

    try:
        output = chain.invoke({"finding_input": format_finding_for_llm(finding)})
    except Exception as exc:
        return {
            "success": False,
            "elapsedMs": _elapsed_ms(started_at),
            "error": str(exc),
        }

    return {
        "success": not contains_disallowed_script(output),
        "elapsedMs": _elapsed_ms(started_at),
        "containsDisallowedScript": contains_disallowed_script(output),
        "charCount": len(output),
        "preview": output[:300],
    }


def _evaluate_fix(target: ModelTarget, finding: dict[str, Any]) -> dict[str, Any]:
    chain = FIX_PROMPT | _create_llm(target, response_format="json") | StrOutputParser()
    started_at = time.perf_counter()

    try:
        output = chain.invoke({"finding_input": format_finding_for_llm(finding)})
    except Exception as exc:
        return {
            "success": False,
            "elapsedMs": _elapsed_ms(started_at),
            "error": str(exc),
        }

    try:
        parsed = parse_fix_response(output)
    except ValueError as exc:
        return {
            "success": False,
            "elapsedMs": _elapsed_ms(started_at),
            "error": str(exc),
            "preview": output[:300],
        }

    return {
        "success": True,
        "elapsedMs": _elapsed_ms(started_at),
        "priority": parsed["priority"],
        "recommendedActionCount": len(parsed["recommendedActions"]),
        "cautionCount": len(parsed["cautions"]),
        "preview": json.dumps(parsed, ensure_ascii=False)[:300],
    }


def _summarize_model(results: list[dict[str, Any]]) -> dict[str, Any]:
    explain_results = [item["explanation"] for item in results]
    fix_results = [item["fix"] for item in results]
    total_elapsed = sum(
        item["explanation"]["elapsedMs"] + item["fix"]["elapsedMs"]
        for item in results
    )

    return {
        "findingCount": len(results),
        "explanationSuccessCount": sum(1 for item in explain_results if item["success"]),
        "fixSuccessCount": sum(1 for item in fix_results if item["success"]),
        "explanationDisallowedScriptCount": sum(
            1 for item in explain_results if item.get("containsDisallowedScript")
        ),
        "totalElapsedMs": total_elapsed,
        "averageElapsedMsPerFinding": int(total_elapsed / len(results))
        if results
        else 0,
    }


def compare_models(
    models: list[str],
    scan_result_path: str,
    limit: int,
) -> dict[str, Any]:
    findings = _load_valid_findings(scan_result_path, limit)
    model_results: list[dict[str, Any]] = []

    for model_spec in models:
        target = _parse_model_target(model_spec)
        print(f"Evaluating model: {target.name}")
        finding_results: list[dict[str, Any]] = []

        for finding in findings:
            finding_id = finding["id"]
            print(f"  Finding: {finding_id}")
            finding_results.append(
                {
                    "findingId": finding_id,
                    "explanation": _evaluate_explanation(target, finding),
                    "fix": _evaluate_fix(target, finding),
                }
            )

        model_results.append(
            {
                "provider": target.provider,
                "model": target.model,
                "target": target.name,
                "summary": _summarize_model(finding_results),
                "findings": finding_results,
            }
        )

    return {
        "scanResultPath": scan_result_path,
        "evaluatedFindingCount": len(findings),
        "models": model_results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare Ollama, Anthropic Claude, and GMS models."
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=list(DEFAULT_MODELS),
        help=(
            "Model specs to evaluate. Use plain Ollama names like qwen2.5:3b "
            "or provider-prefixed specs like gms:claude-3-5-haiku-latest."
        ),
    )
    parser.add_argument(
        "--include-claude",
        action="store_true",
        help=f"Also evaluate anthropic:{ANTHROPIC_MODEL}.",
    )
    parser.add_argument(
        "--include-gms",
        action="store_true",
        help=f"Also evaluate gms:{GMS_MODEL}.",
    )
    parser.add_argument(
        "--scan-result-path",
        default="data/scan_result.json",
        help="Path to scan_result.json.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=3,
        help="Number of valid findings to evaluate.",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_PATH,
        help="Path to write JSON comparison results.",
    )
    args = parser.parse_args()
    models = list(args.models)
    if args.include_claude:
        models.append(f"anthropic:{ANTHROPIC_MODEL}")
    if args.include_gms:
        models.append(f"gms:{GMS_MODEL}")

    result = compare_models(
        models=models,
        scan_result_path=args.scan_result_path,
        limit=args.limit,
    )

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = PROJECT_ROOT / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(result["models"], ensure_ascii=False, indent=2))
    print(f"Wrote comparison result: {output_path}")


if __name__ == "__main__":
    main()
