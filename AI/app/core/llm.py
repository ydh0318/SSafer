import socket
import time
from typing import Any

import httpx
from langchain_ollama import ChatOllama

from app.core.config import (
    OLLAMA_BASE_URL,
    OLLAMA_MAX_RETRIES,
    OLLAMA_MODEL,
    OLLAMA_RETRY_BACKOFF_SECONDS,
    OLLAMA_TEMPERATURE,
    OLLAMA_TIMEOUT_SECONDS,
)


class LLMCallError(RuntimeError):
    pass


class LLMTimeoutError(LLMCallError):
    pass


def get_ollama_llm(response_format: str | None = None) -> ChatOllama:
    return ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=OLLAMA_TEMPERATURE,
        format=response_format,
        sync_client_kwargs={"timeout": OLLAMA_TIMEOUT_SECONDS},
    )


def is_timeout_error(exc: BaseException) -> bool:
    return isinstance(exc, (TimeoutError, socket.timeout, httpx.TimeoutException))


def invoke_llm_with_retry(
    runnable: Any,
    input_data: Any,
    *,
    max_retries: int = OLLAMA_MAX_RETRIES,
    backoff_seconds: float = OLLAMA_RETRY_BACKOFF_SECONDS,
) -> Any:
    last_error: Exception | None = None
    max_retries = max(0, max_retries)
    total_attempts = max_retries + 1

    for attempt in range(total_attempts):
        try:
            return runnable.invoke(input_data)
        except Exception as exc:
            last_error = exc
            if attempt < max_retries and backoff_seconds > 0:
                time.sleep(backoff_seconds)

    if last_error is None:
        raise LLMCallError("LLM call failed.")

    message = (
        f"LLM call failed after {total_attempts} attempt(s): {last_error}"
    )
    if is_timeout_error(last_error):
        raise LLMTimeoutError(message) from last_error
    raise LLMCallError(message) from last_error
