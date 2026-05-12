from langchain_core.runnables import Runnable

from app.core.config import LLM_FIX_MAX_TOKENS
from app.core.llm import get_llm
from app.prompts.fix_prompt import FIX_PROMPT


def create_fix_chain() -> Runnable:
    return FIX_PROMPT | get_llm(
        response_format="json",
        max_tokens=LLM_FIX_MAX_TOKENS,
    )
