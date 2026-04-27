# AI

FastAPI 기반 AI 서버입니다.

## Setup

```bash
cd /S14P31B105/AI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

## Health Check

```bash
curl http://127.0.0.1:8000/health
```
