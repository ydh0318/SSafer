# FastAPI 서버 구축

이 문서는 AI 모듈의 FastAPI 서버를 처음 실행하는 방법을 정리한 문서입니다.

## 1. 프로젝트 위치

AI 서버 코드는 아래 디렉토리에 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
```

## 2. 가상환경 생성

```bash
python3 -m venv .venv
```

## 3. 가상환경 활성화

```bash
source .venv/bin/activate
```

정상적으로 활성화되면 터미널 앞에 `(.venv)`가 표시됩니다.

## 4. 의존성 설치

```bash
pip install -r requirements.txt
```

## 5. 서버 실행

```bash
uvicorn app.main:app --reload
```

기본 주소는 아래와 같습니다.

```text
http://127.0.0.1:8000
```

## 6. Health Check

```bash
curl http://127.0.0.1:8000/health
```

정상 응답:

```json
{"status":"ok"}
```

## 7. Analyze 엔드포인트 확인

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

`/analyze`는 `scan_result.json`을 읽어 분석 파이프라인을 실행하고 `analysis_result.json`을 저장합니다.

```json
{
  "status": "completed",
  "message": null,
  "stage": null,
  "finding_id": null,
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 1,
  "valid_finding_count": 1,
  "invalid_finding_count": 0,
  "result_count": 1,
  "invalid_findings": []
}
```

## 8. 관련 문서

```text
1_ollama_setup.md
2_langchain_setup.md
8_analyze_api.md
9_test_guide.md
```
