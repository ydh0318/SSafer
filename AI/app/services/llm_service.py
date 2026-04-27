from app.core.llm import get_ollama_llm


def generate_basic_response(prompt: str) -> str:
    llm = get_ollama_llm()
    response = llm.invoke(prompt)
    return response.content
