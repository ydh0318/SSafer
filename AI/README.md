# AI

FastAPI 기반 AI 서버입니다.

현재 구현된 주요 API:

```text
GET /health
POST /analyze
```

## Documents

```text
docs/0_fastapi_setup.md
docs/1_ollama_setup.md
docs/2_langchain_setup.md
docs/3_scan_result_input.md
docs/4_explain_chain.md
docs/5_analysis_result_output.md
docs/6_fix_chain.md
docs/7_local_model_comparison.md
docs/8_analyze_api.md
docs/9_test_guide.md
docs/10_s3_setup.md
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

## Analyze

`/analyze`는 로컬 `scan_result.json` 경로를 받아 분석 파이프라인을 실행하고 `analysis_result.json`을 저장합니다.

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

자세한 API 스펙은 `docs/8_analyze_api.md`, 테스트 방법은 `docs/9_test_guide.md`를 참고합니다.
