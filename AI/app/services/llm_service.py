from app.core.llm import get_llm, invoke_llm_with_retry


def generate_basic_response(prompt: str) -> str:
    llm = get_llm()
    response = invoke_llm_with_retry(llm, prompt)
    return response.content
