# Analyze API

이 문서는 현재 구현된 FastAPI `/analyze` 엔드포인트 스펙을 정리합니다.

Spring Boot, RabbitMQ Worker 연동 전체 계약은 `11_spring_fastapi_interface.md`를 함께 참고합니다.

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

서비스 내부에서는 아래 단계로 API 흐름과 분석 파이프라인을 연결합니다.

| 단계 | 함수 | 역할 |
| --- | --- | --- |
| API 진입 | `analyze_scan_result()` | `AnalysisRequest`를 받아 파일 기반 또는 inline 기반 분석 흐름 선택 |
| 파일 로딩 | `run_analysis_pipeline()` | `scan_result_path`에서 JSON 파일 로딩 |
| 입력 준비 | `prepare_analysis_pipeline_context()` | 최상위 검증, findings 추출, valid/invalid finding 분리 |
| 분석 실행 | `analyze_findings()` | valid finding별 explanation/fix 생성 |
| 결과 저장 | `build_analysis_result_from_results()`, `save_analysis_result()` | `analysis_result.json` 생성, 매핑 검증, 파일 저장 |
| 응답 반환 | `AnalysisResponse` | 처리 상태와 count 정보 반환 |

기본 설정:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TEMPERATURE=0.1
OLLAMA_TIMEOUT_SECONDS=120
OLLAMA_MAX_RETRIES=2
OLLAMA_RETRY_BACKOFF_SECONDS=1
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
  "analysis_result_path": "data/analysis_result.json",
  "scan_result": null,
  "taskId": null,
  "agentId": null,
  "projectId": null,
  "scanId": null,
  "rawResultPath": null,
  "analysisResultPath": null
}
```

필드:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `scan_result_path` | string | 아니오 | `data/scan_result.json` | 분석할 scan_result.json 경로 |
| `analysis_result_path` | string | 아니오 | `data/analysis_result.json` | 저장할 analysis_result.json 경로 |
| `scan_result` | object 또는 null | 아니오 | `null` | 요청 본문에 직접 전달하는 scan_result.json 객체 |
| `taskId` | number 또는 null | Worker 연동 시 예 | `null` | Spring Boot `agent_tasks.id` |
| `agentId` | number 또는 null | Worker 연동 시 예 | `null` | 작업을 처리하는 agent ID |
| `projectId` | number 또는 null | Worker 연동 시 예 | `null` | scan이 속한 project ID |
| `scanId` | number 또는 null | Worker 연동 시 예 | `null` | Spring Boot `scans.id` |
| `rawResultPath` | string 또는 null | Worker 연동 시 예 | `null` | 분석할 raw result S3 URI |
| `analysisResultPath` | string 또는 null | Worker 연동 시 예 | `null` | analysis result 업로드 대상 S3 URI |

상대 경로는 AI 서버 실행 위치 기준으로 해석됩니다.

`scan_result`가 있으면 파일 경로 대신 요청 본문의 객체를 분석합니다. 이 경우 `scan_result_path`는 응답과 로깅에서 입력 출처를 표시하는 값으로 사용됩니다.

현재 구현은 기존 로컬 파일/inline 분석 흐름과의 호환을 위해 `scan_result_path`, `analysis_result_path`, `scan_result`를 계속 지원합니다.
Worker 연동 필드는 Spring Boot 상태/결과 콜백과 로깅에 필요한 메타데이터입니다.
`rawResultPath`가 있으면 FastAPI는 해당 S3 객체를 로컬 파일로 저장하지 않고 메모리에서 JSON으로 파싱한 뒤 분석합니다.
`analysisResultPath`가 있으면 생성된 `analysis_result.json`도 임시 파일 없이 해당 S3 경로로 업로드합니다.

Worker 연동 요청 예시:

```json
{
  "taskId": 123,
  "agentId": 10,
  "projectId": 2,
  "scanId": 5,
  "rawResultPath": "s3://ssafer-scan-storage-dev/raw/5/71b37aca-1468-419d-af27-75a56ab97b5e/scan_result.json",
  "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
}
```

주의: Worker 연동 요청의 `scanId`는 Spring Boot `scans.id`입니다. raw `scan_result.json` 내부의 `scanId`는 CLI 원본 UUID이므로 같은 값으로 취급하지 않습니다.

## 3-1. scan_result DTO

`scan_result` 객체는 아래 필드를 필수로 갖습니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `schemaVersion` | string | 현재 지원 버전은 `0.1` |
| `scanId` | string | UUID v4 |
| `source` | string | 현재 허용 값은 `cli` |
| `scannedAt` | string | ISO 8601 datetime |
| `analysisStatus` | string | `SUCCESS`, `PARTIAL`, `FAILED` |
| `findings` | array | 분석 대상 finding 배열 |

개별 valid finding은 아래 필드를 필수로 갖습니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | finding ID |
| `ruleId` | string | 탐지 규칙 ID |
| `source` | string | 탐지 출처 |
| `severity` | string | 심각도 |
| `file` | string | 대상 파일 |
| `line` | integer 또는 null | 라인 번호 |
| `title` | string | finding 제목 |
| `maskedEvidence` | string | 마스킹된 근거 |

일부 finding이 DTO 검증에 실패하면 전체 요청을 실패시키지 않고 `invalid_findings`에 기록합니다.

Inline 요청 예시:

```json
{
  "scan_result_path": "inline",
  "analysis_result_path": "data/analysis_result.json",
  "scan_result": {
    "schemaVersion": "0.1",
    "scanId": "a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd",
    "source": "cli",
    "scannedAt": "2026-04-27T00:26:05Z",
    "analysisStatus": "SUCCESS",
    "findings": [
      {
        "id": "FND-0001",
        "ruleId": "ENV_PLAIN_SECRET",
        "source": "custom-rule",
        "severity": "HIGH",
        "file": ".env",
        "line": 1,
        "title": "Plain secret in env file",
        "maskedEvidence": "DB_PASSWORD=***MASKED***"
      }
    ]
  }
}
```

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

응답 필드:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `status` | string | 성공 시 `completed` |
| `message` | string 또는 null | 성공 시 보통 `null` |
| `stage` | string 또는 null | 성공 시 `null` |
| `finding_id` | string 또는 null | 성공 시 `null` |
| `scan_result_path` | string | 입력 scan result 경로 또는 출처 |
| `analysis_result_path` | string 또는 null | 저장된 analysis result 경로 |
| `finding_count` | number | raw finding 전체 개수 |
| `valid_finding_count` | number | 분석 대상 finding 개수 |
| `invalid_finding_count` | number | 검증 실패로 제외된 finding 개수 |
| `result_count` | number | 생성된 분석 결과 개수 |
| `invalid_findings` | array | 제외된 finding 목록 |

일부 finding이 유효하지 않아 제외되었지만 valid finding 분석은 완료된 경우에도 `status`는 `completed`를 유지하고, 제외 목록만 `invalid_findings`에 기록합니다.

```json
{
  "status": "completed",
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

`/analyze`는 파이프라인 실패 시 HTTP 상태 코드와 표준 에러 바디를 함께 반환합니다.

HTTP 상태 코드 정책:

| HTTP status | stage | 의미 |
| --- | --- | --- |
| `400` | `input` | 요청 입력, 파일 로딩, JSON 파싱, scan_result 검증 실패 |
| `502` | `explain` | explanation 생성 실패 |
| `502` | `fix` | fix 생성 실패 |
| `502` | `analysis` | 일반 분석 파이프라인 실패 |
| `500` | `output` | analysis_result 생성, 검증, 저장 실패 |

에러 응답 공통 필드:

| 필드 | 설명 |
| --- | --- |
| `status` | 항상 `failed` |
| `error_code` | Spring에서 분기 가능한 표준 에러 코드 |
| `message` | 실패 원인 메시지 |
| `stage` | 실패 단계 |
| `finding_id` | 특정 finding 처리 중 실패한 경우 finding ID |
| `scan_result_path` | 입력 scan_result 경로 또는 출처 |
| `analysis_result_path` | 결과 저장 경로 |
| `finding_count` | 전체 finding 수 |
| `valid_finding_count` | valid finding 수 |
| `invalid_finding_count` | invalid finding 수 |
| `result_count` | 생성된 결과 수 |
| `invalid_findings` | invalid finding 목록 |

입력 파일이 없는 경우:

HTTP status:

```text
400 Bad Request
```

```json
{
  "status": "failed",
  "error_code": "ANALYSIS_INPUT_ERROR",
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

HTTP status:

```text
502 Bad Gateway
```

```json
{
  "status": "failed",
  "error_code": "ANALYSIS_EXPLAIN_ERROR",
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

`error_code` 값:

| error_code | 의미 |
| --- | --- |
| `ANALYSIS_INPUT_ERROR` | 입력 처리 실패 |
| `ANALYSIS_EXPLAIN_ERROR` | explanation 생성 실패 |
| `ANALYSIS_FIX_ERROR` | fix 생성 실패 |
| `ANALYSIS_PIPELINE_ERROR` | 일반 분석 실패 |
| `ANALYSIS_OUTPUT_ERROR` | 결과 생성 또는 저장 실패 |
| `ANALYSIS_ERROR` | 매핑되지 않은 분석 실패 |

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
