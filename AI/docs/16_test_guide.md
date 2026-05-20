# 테스트 가이드

이 문서는 현재 구현 상태에서 FastAPI `/analyze` 엔드포인트와 분석 파이프라인을 확인하는 방법을 정리합니다.

## 1. 기본 준비

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
pip install -r requirements.txt
```

실제 `/analyze` 호출은 LLM을 사용하므로 Ollama 서버와 모델이 필요합니다.

```bash
ollama serve
```

다른 터미널:

```bash
ollama list
ollama pull qwen2.5:3b
```

## 2. 빠른 정적 검증

Python 문법과 import 가능 여부를 확인합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m compileall app tests
```

정상이라면 마지막에 에러 없이 종료됩니다.

## 3. 엔드포인트 연결 테스트

현재 추가된 테스트는 실제 Ollama를 호출하지 않고 `/analyze` 핸들러가 분석 파이프라인에 요청 값을 넘기는지 확인합니다.
Spring/Worker 연동용 camelCase 필드(`taskId`, `rawResultPath`, `analysisResultPath`)가 S3 분석 흐름으로 연결되는지도 함께 확인합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_analysis_pipeline_api_flow tests.test_analyze_endpoint tests.test_fastapi_client tests.test_worker_processor tests.test_worker_bootstrap
```

정상 출력:

```text
.................................
----------------------------------------------------------------------
Ran 52 tests in 0.016s

OK
```

`tests.test_fastapi_client`는 Worker가 FastAPI에 `POST /analyze`를 호출할 때 Spring 계약 payload를 그대로 전송하는지 검증합니다.
`tests.test_analysis_pipeline_api_flow`는 FastAPI 분석 파이프라인 응답과 stage별 duration 로그를 검증합니다.
`tests.test_worker_processor`는 RabbitMQ 메시지를 받은 Worker가 `/analyze` 요청을 만들고 최신 Spring 분석 완료 콜백 payload로 변환하는지 검증합니다.
`tests.test_worker_bootstrap`는 Worker가 HTTP status별 RabbitMQ requeue 정책을 올바르게 선택하는지 검증합니다.

## 3-1. scan_result DTO 파싱 테스트

scan_result.json DTO 파싱과 invalid finding 분리 로직을 확인합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_scan_result_dto
```

정상 출력:

```text
...
----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

## 3-2. API 파이프라인 통합 테스트

실제 Ollama 호출은 mock으로 대체하고, `/analyze` 서비스 흐름이 입력 준비, 분석 결과 조립, `analysis_result.json` 저장까지 수행하는지 확인합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_analysis_pipeline_api_flow
```

정상 출력:

```text
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

## 4. Health Check 테스트

서버 실행:

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
uvicorn app.main:app --reload
```

다른 터미널:

```bash
curl http://127.0.0.1:8000/health
```

정상 응답:

```json
{"status":"ok"}
```

## 5. Analyze API 성공 테스트

Ollama가 실행 중이고 `qwen2.5:3b` 모델이 준비되어 있어야 합니다.

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

기대 결과:

```text
status가 completed
analysis_result_path 위치에 analysis_result.json 생성
result_count가 valid_finding_count와 일치
```

저장된 결과 파일 검증:

```bash
python -c "from app.services.result_service import load_analysis_result; result = load_analysis_result('data/analysis_result.json'); print('valid', result['resultCount'])"
```

## 6. Analyze API 실패 테스트

존재하지 않는 파일을 넘겨 input 실패 응답을 확인합니다.

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"missing.json"}'
```

기대 결과:

```text
HTTP status: 400
status: failed
error_code: ANALYSIS_INPUT_ERROR
stage: input
message: scan_result.json file not found ...
```

## 7. Spring/Worker Analyze 계약 수동 확인

FastAPI 서버가 실행 중이고 S3/Ollama 설정이 준비되어 있다면 Spring 또는 curl에서 아래 payload로 `/analyze` 계약을 확인할 수 있습니다.

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": 123,
    "agentId": 10,
    "projectId": 2,
    "scanId": 5,
    "rawResultPath": "s3://ssafer-scan-storage-dev/raw/5/scan_result.json",
    "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
  }'
```

기대 결과:

```text
HTTP status: 200
status: completed
scan_result_path: rawResultPath와 동일
analysis_result_path: analysisResultPath와 동일
```

## 8. 로깅 확인

scanId 기준 로깅과 stage별 처리 시간(`durationMs`) 측정은 구현되어 있습니다. Worker와 FastAPI 로그에 포함되는 필드는 `13_spring_fastapi_interface.md`의 로깅 필드 섹션을 참고합니다.
