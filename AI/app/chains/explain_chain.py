from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable

from app.core.llm import get_llm
from app.prompts.explain_prompt import EXPLAIN_PROMPT


def create_explain_chain() -> Runnable:
    return EXPLAIN_PROMPT | get_llm() | StrOutputParser()
