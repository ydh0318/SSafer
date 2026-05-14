from langchain_core.runnables import Runnable

from app.core.config import LLM_EXPLAIN_MAX_TOKENS
from app.core.llm import get_llm
from app.prompts.explain_prompt import EXPLAIN_PROMPT


def create_explain_chain() -> Runnable:
    return EXPLAIN_PROMPT | get_llm(
        response_format="json",
        max_tokens=LLM_EXPLAIN_MAX_TOKENS,
    )
