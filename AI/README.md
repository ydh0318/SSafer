# AI

FastAPI 기반 AI 서버입니다.

## Documents

```text
docs/0_fastapi_setup.md
docs/1_ollama_setup.md
docs/2_langchain_ollama_setup.md
```

## Quick Start

```bash
cd /home/eunsu/S14P31B105/AI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Health Check

```bash
curl http://127.0.0.1:8000/health
```
