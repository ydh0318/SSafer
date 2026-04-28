from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable

from app.core.llm import get_ollama_llm
from app.prompts.fix_prompt import FIX_PROMPT


def create_fix_chain() -> Runnable:
    return FIX_PROMPT | get_ollama_llm(response_format="json") | StrOutputParser()
