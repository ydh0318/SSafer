from app.core.llm import get_ollama_llm, invoke_llm_with_retry


def generate_basic_response(prompt: str) -> str:
    llm = get_ollama_llm()
    response = invoke_llm_with_retry(llm, prompt)
    return response.content
