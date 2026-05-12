import logging
from typing import Any

from app.core.logging_utils import log_with_fields


ESTIMATED_CHARS_PER_TOKEN = 3


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + ESTIMATED_CHARS_PER_TOKEN - 1) // ESTIMATED_CHARS_PER_TOKEN)


def get_llm_response_text(response: Any) -> str:
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    return str(content)


def get_llm_usage_metadata(
    response: Any,
) -> tuple[int | None, int | None, int | None, str | None]:
    usage = getattr(response, "usage_metadata", None)
    if isinstance(usage, dict):
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        total_tokens = usage.get("total_tokens")
        if isinstance(input_tokens, int) or isinstance(output_tokens, int):
            return input_tokens, output_tokens, total_tokens, "usage_metadata"

    response_metadata = getattr(response, "response_metadata", None)
    if isinstance(response_metadata, dict):
        response_usage = response_metadata.get("usage")
        if isinstance(response_usage, dict):
            input_tokens = response_usage.get("input_tokens")
            output_tokens = response_usage.get("output_tokens")
            total_tokens = response_usage.get("total_tokens")
            if (
                total_tokens is None
                and isinstance(input_tokens, int)
                and isinstance(output_tokens, int)
            ):
                total_tokens = input_tokens + output_tokens
            if isinstance(input_tokens, int) or isinstance(output_tokens, int):
                return input_tokens, output_tokens, total_tokens, "response_metadata.usage"

    return None, None, None, None


def log_llm_usage(
    *,
    logger: logging.Logger,
    stage: str,
    finding_id: str | None,
    input_text: str,
    response: Any,
    attempt_count: int,
    max_output_tokens: int | None,
) -> None:
    output_text = get_llm_response_text(response)
    actual_input_tokens, actual_output_tokens, actual_total_tokens, usage_source = (
        get_llm_usage_metadata(response)
    )
    usage_fields: dict[str, Any]
    if usage_source:
        usage_fields = {
            "inputTokens": actual_input_tokens,
            "outputTokens": actual_output_tokens,
            "totalTokens": actual_total_tokens,
            "usageSource": usage_source,
        }
    else:
        usage_fields = {
            "estimatedInputTokens": estimate_tokens(input_text),
            "estimatedOutputTokens": estimate_tokens(output_text),
            "usageSource": "estimated",
        }

    log_with_fields(
        logger,
        logging.INFO,
        "LLM usage recorded.",
        stage=stage,
        findingId=finding_id,
        inputChars=len(input_text),
        outputChars=len(output_text),
        **usage_fields,
        attemptCount=attempt_count,
        maxOutputTokens=max_output_tokens,
    )
