# LangChain Ollama 연동 설정

이 문서는 FastAPI AI 서버에서 LangChain을 통해 로컬 Ollama 모델을 호출하기 위한 기본 설정을 정리한 문서입니다.

## 1. 사전 조건

Ollama CLI와 모델이 먼저 준비되어 있어야 합니다.

```bash
ollama serve
```

다른 터미널에서 모델 목록을 확인합니다.

```bash
ollama list
```

이 프로젝트의 기본 모델은 아래 모델입니다.

```text
qwen2.5:3b
```

모델이 없다면 설치합니다.

```bash
ollama pull qwen2.5:3b
```

Ollama 설치 방법은 [02_ollama_setup.md](02_ollama_setup.md)를 참고합니다.

## 2. Python 의존성

LangChain과 Ollama 연동을 위해 아래 패키지를 사용합니다.

```text
langchain
langchain-ollama
```

가상환경을 활성화한 뒤 의존성을 설치합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Ollama 설정 파일

Ollama 접속 정보와 기본 모델명은 아래 파일에서 관리합니다.

```text
app/core/config.py
```

현재 기본값은 다음과 같습니다.

```python
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:3b"
```

환경변수로 값을 바꿀 수도 있습니다.

```bash
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_MODEL="qwen2.5:3b"
```

환경변수를 지정하지 않으면 기본값을 사용합니다.

## 4. LangChain LLM 생성 함수

LangChain에서 Ollama 모델을 사용할 수 있도록 아래 파일에 LLM 생성 함수를 정의했습니다.

```text
app/core/llm.py
```

현재 구현은 다음 구조입니다.

```python
from langchain_ollama import ChatOllama

from app.core.config import OLLAMA_BASE_URL, OLLAMA_MODEL


def get_ollama_llm() -> ChatOllama:
    return ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
    )
```

앞으로 Explain Chain, Fix Chain 등에서 이 함수를 사용해 동일한 Ollama LLM 설정을 재사용합니다.

## 5. 설정 확인

아래 명령어로 LangChain Ollama 객체가 정상 생성되는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.core.llm import get_ollama_llm; llm = get_ollama_llm(); print(type(llm).__name__, llm.model, llm.base_url)"
```

정상이라면 아래처럼 출력됩니다.

```text
ChatOllama qwen2.5:3b http://127.0.0.1:11434
```

이 단계는 LLM 객체 생성 확인입니다.

## 6. LLM 호출 테스트

LLM 객체 생성에 이어, LangChain이 실제로 Ollama 모델에 프롬프트를 보내고 응답을 받는지 확인합니다. 재시도 로직이 포함된 호출 헬퍼는 아래 파일에 있습니다.

```text
app/core/llm.py
```

먼저 Ollama 서버를 실행합니다.

```bash
ollama serve
```

다른 터미널에서 `get_ollama_llm()`으로 만든 LLM에 실제 프롬프트를 보내봅니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.core.llm import get_ollama_llm, invoke_llm_with_retry; llm = get_ollama_llm(); print(invoke_llm_with_retry(llm, 'Reply with only this word: OK').content)"
```

정상이라면 아래처럼 출력됩니다.

```text
OK
```

이 응답이 출력되면 LangChain이 로컬 Ollama 모델을 실제로 호출하고, 기본 응답을 생성한 것입니다.
