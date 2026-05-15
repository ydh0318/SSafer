from langchain_core.runnables import Runnable

from app.core.config import LLM_FIX_MAX_TOKENS
from app.core.llm import get_llm
from app.prompts.fix_prompt import BATCH_FIX_PROMPT, FIX_PROMPT


def create_fix_chain() -> Runnable:
    return FIX_PROMPT | get_llm(
        response_format="json",
        max_tokens=LLM_FIX_MAX_TOKENS,
    )


def create_batch_fix_chain(max_tokens: int) -> Runnable:
    return BATCH_FIX_PROMPT | get_llm(
        response_format="json",
        max_tokens=max_tokens,
    )
