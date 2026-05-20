# AI

FastAPI 기반 AI 서버입니다.

현재 구현된 주요 API:

```text
GET /health
POST /analyze
```

## Documents

```text
docs/00_architecture_overview.md
docs/01_fastapi_setup.md
docs/02_ollama_setup.md
docs/03_langchain_setup.md
docs/04_s3_setup.md
docs/05_configuration.md
docs/06_scan_result_input.md
docs/07_analysis_result_output.md
docs/08_explain_chain.md
docs/09_fix_chain.md
docs/10_verify_chain.md
docs/11_agent_graph.md
docs/12_analyze_api.md
docs/13_spring_fastapi_interface.md
docs/14_local_model_comparison.md
docs/15_external_model_comparison.md
docs/16_test_guide.md
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

자세한 API 스펙은 `docs/12_analyze_api.md`, 테스트 방법은 `docs/16_test_guide.md`를 참고합니다. 전체 구조는 `docs/00_architecture_overview.md`부터 봅니다.
