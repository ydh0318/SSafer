from langchain_core.runnables import Runnable

from app.core.config import LLM_VERIFY_MAX_TOKENS
from app.core.llm import get_llm
from app.prompts.verify_prompt import VERIFY_PROMPT


def create_verify_chain() -> Runnable:
    return VERIFY_PROMPT | get_llm(
        response_format="json",
        max_tokens=LLM_VERIFY_MAX_TOKENS,
    )
