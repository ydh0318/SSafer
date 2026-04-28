import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from app.services.llm_service import generate_basic_response


def main():
    response = generate_basic_response("Reply with only this word: OK")
    print(response)


if __name__ == "__main__":
    main()
