import logging
import socket
import threading
import time
from typing import Any

import httpx
from langchain_ollama import ChatOllama

from app.core.config import (
    MAX_LLM_CONCURRENCY,
    OLLAMA_MAX_RETRIES,
    OLLAMA_RETRY_BACKOFF_SECONDS,
    OLLAMA_TIMEOUT_SECONDS,
)
from app.core.llm_provider import get_llm_provider

logger = logging.getLogger(__name__)

_llm_semaphore = threading.Semaphore(MAX_LLM_CONCURRENCY)
_llm_active_lock = threading.Lock()
_llm_active_calls = 0


class LLMCallError(RuntimeError):
    pass


class LLMTimeoutError(LLMCallError):
    pass


def get_ollama_llm(
    response_format: str | None = None,
    max_tokens: int | None = None,
) -> ChatOllama:
    provider = get_llm_provider("ollama")
    provider.timeout_seconds = OLLAMA_TIMEOUT_SECONDS
    return provider.create_chat_model(
        response_format=response_format,
        max_tokens=max_tokens,
    )


def get_llm(
    response_format: str | None = None,
    max_tokens: int | None = None,
) -> Any:
    return get_llm_provider().create_chat_model(
        response_format=response_format,
        max_tokens=max_tokens,
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
            logger.debug(
                "Waiting for LLM semaphore. max_concurrency=%d attempt=%d/%d",
                MAX_LLM_CONCURRENCY,
                attempt + 1,
                total_attempts,
            )
            _llm_semaphore.acquire()
            try:
                global _llm_active_calls
                with _llm_active_lock:
                    _llm_active_calls += 1
                    active_calls = _llm_active_calls
                logger.info(
                    "LLM call started. active=%d max_concurrency=%d attempt=%d/%d",
                    active_calls,
                    MAX_LLM_CONCURRENCY,
                    attempt + 1,
                    total_attempts,
                )
                result = runnable.invoke(input_data)
            finally:
                with _llm_active_lock:
                    _llm_active_calls -= 1
                    active_calls = _llm_active_calls
                _llm_semaphore.release()
                logger.info(
                    "LLM call finished. active=%d max_concurrency=%d",
                    active_calls,
                    MAX_LLM_CONCURRENCY,
                )
            return result
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
