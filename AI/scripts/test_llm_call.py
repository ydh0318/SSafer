import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.core.llm import get_ollama_llm


def main():
    llm = get_ollama_llm()
    response = llm.invoke("Reply with only this word: OK")
    print(response.content)


if __name__ == "__main__":
    main()
