import logging
import time
from typing import Any


def monotonic_ms() -> int:
    return int(time.perf_counter() * 1000)


def elapsed_ms(started_ms: int) -> int:
    return max(0, monotonic_ms() - started_ms)


def format_log_fields(**fields: Any) -> str:
    return " ".join(
        f"{key}={value}"
        for key, value in fields.items()
        if value is not None
    )


def log_with_fields(
    logger: logging.Logger,
    level: int,
    message: str,
    *,
    exc_info: Any = False,
    **fields: Any,
) -> None:
    field_text = format_log_fields(**fields)
    if field_text:
        logger.log(level, "%s %s", message, field_text, exc_info=exc_info)
        return
    logger.log(level, "%s", message, exc_info=exc_info)
