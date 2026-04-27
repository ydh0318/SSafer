# AI

FastAPI 기반 AI 서버입니다.

## Setup

```bash
cd /home/eunsu/S14P31B105/AI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Ollama

Ollama 설치와 모델 실행 방법은 [docs/ollama_setup.md](docs/ollama_setup.md)를 참고하세요.

## Run

```bash
uvicorn app.main:app --reload
```

## Health Check

```bash
curl http://127.0.0.1:8000/health
```
