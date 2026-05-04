# Analyze API

이 문서는 현재 구현된 FastAPI `/analyze` 엔드포인트 스펙을 정리합니다.

## 1. Endpoint

```text
POST /analyze
```

호환용으로 `POST /analysis`도 남아 있지만 OpenAPI 문서에는 노출하지 않습니다. 신규 연동은 `/analyze`를 사용합니다.

## 2. 처리 흐름

```text
요청 DTO 파싱
scan_result.json 파일 로딩
scan_result.json 최상위 필드 검증
findings 추출
valid/invalid finding 분리
valid finding별 explanation 생성
valid finding별 fix 생성
analysis_result.json 생성 및 저장
API 응답 반환
```

현재 LLM 호출은 로컬 Ollama를 사용합니다.

기본 설정:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TEMPERATURE=0.1
```

## 3. Request

Content-Type:

```text
application/json
```

Body:

```json
{
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json"
}
```

필드:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `scan_result_path` | string | 아니오 | `data/scan_result.json` | 분석할 scan_result.json 경로 |
| `analysis_result_path` | string | 아니오 | `data/analysis_result.json` | 저장할 analysis_result.json 경로 |

상대 경로는 AI 서버 실행 위치 기준으로 해석됩니다.

## 4. Success Response

분석이 정상 완료되면 아래 형식으로 응답합니다.

```json
{
  "status": "completed",
  "message": null,
  "stage": null,
  "finding_id": null,
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "/home/eunsu/S14P31B105/AI/data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 3,
  "invalid_finding_count": 0,
  "result_count": 3,
  "invalid_findings": []
}
```

일부 finding이 유효하지 않아 제외되었지만 valid finding 분석은 완료된 경우:

```json
{
  "status": "completed_with_invalid_findings",
  "message": null,
  "stage": null,
  "finding_id": null,
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "/home/eunsu/S14P31B105/AI/data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 2,
  "invalid_finding_count": 1,
  "result_count": 2,
  "invalid_findings": [
    {
      "index": 1,
      "findingId": "FND-0002",
      "reason": "findings[1] missing required fields: maskedEvidence"
    }
  ]
}
```

## 5. Failure Response

현재 `/analyze`는 파이프라인 실패도 HTTP 200 응답 안의 `status: failed`로 반환합니다. HTTP 상태 코드 기반 예외 처리는 다음 태스크에서 강화할 예정입니다.

입력 파일이 없는 경우:

```json
{
  "status": "failed",
  "message": "scan_result.json file not found: /home/eunsu/S14P31B105/AI/missing.json",
  "stage": "input",
  "finding_id": null,
  "scan_result_path": "missing.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 0,
  "valid_finding_count": 0,
  "invalid_finding_count": 0,
  "result_count": 0,
  "invalid_findings": []
}
```

분석 중 특정 finding의 explanation 또는 fix 생성이 실패한 경우:

```json
{
  "status": "failed",
  "message": "error message",
  "stage": "explain",
  "finding_id": "FND-0001",
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 3,
  "invalid_finding_count": 0,
  "result_count": 0,
  "invalid_findings": []
}
```

`stage` 값:

| stage | 의미 |
| --- | --- |
| `input` | scan_result.json 로딩, 파싱, 최상위 검증 실패 |
| `explain` | explanation 생성 실패 |
| `fix` | fix 생성 실패 |
| `analysis` | 일반 분석 처리 실패 |
| `output` | analysis_result.json 생성, 검증, 저장 실패 |

## 6. Curl Example

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
uvicorn app.main:app --reload
```

다른 터미널:

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

## 7. OpenAPI

서버 실행 후 브라우저에서 아래 주소를 열면 Swagger UI를 확인할 수 있습니다.

```text
http://127.0.0.1:8000/docs
```
