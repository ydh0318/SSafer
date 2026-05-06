# Spring Boot - FastAPI Interface

이 문서는 Spring Boot 백엔드, RabbitMQ 워커, FastAPI AI 서버가 scan 분석 작업을 주고받기 위한 API 인터페이스를 정리합니다.

## 1. 연동 역할

| 컴포넌트 | 역할 |
| --- | --- |
| Spring Boot | scan/task 상태의 기준 저장소, CLI raw 업로드 보고 수신, RabbitMQ 작업 발행, 워커 콜백 수신 |
| RabbitMQ | Spring Boot가 생성한 분석 작업 메시지 전달 |
| Worker | RabbitMQ 메시지 consume, FastAPI `/analyze` 호출, Spring Boot 상태/결과 콜백 호출 |
| FastAPI | S3 raw 결과 기반 분석 수행, analysis result 생성 |

운영 흐름에서는 Spring Boot가 FastAPI를 직접 호출하지 않고, Worker가 RabbitMQ 메시지를 받아 FastAPI를 호출합니다.
Spring Boot의 `/analyze` 호출 테스트는 API 계약 검증 용도로만 둡니다.

## 2. 전체 처리 흐름

```text
CLI raw 결과 S3 업로드
CLI -> Spring Boot raw-results 보고
Spring Boot -> agent_tasks row 생성
Spring Boot -> RabbitMQ SCAN_REQUEST publish
Worker -> RabbitMQ consume
Worker -> Spring Boot ACKED 콜백
Worker -> Spring Boot RUNNING 콜백
Worker -> FastAPI POST /analyze 호출
FastAPI -> raw result 다운로드/분석/result 생성
Worker -> Spring Boot SUCCEEDED 또는 FAILED 결과 콜백
Spring Boot -> scan, agent_tasks 상태 반영
```

## 3. RabbitMQ 작업 메시지

Worker는 아래 queue에서 메시지를 consume합니다.

| 항목 | 값 |
| --- | --- |
| exchange | `ssafer.agent.tasks` |
| queue | `ssafer.agent.scan.request` |
| routing key | `agent.scan.request` |

메시지 예시:

```json
{
  "messageType": "SCAN_REQUEST",
  "messageVersion": 1,
  "taskType": "SCAN_REQUEST",
  "taskId": 123,
  "agentId": 10,
  "projectId": 2,
  "scanId": 5,
  "rawResultPath": "s3://ssafer-scan-storage-dev/raw/5/71b37aca-1468-419d-af27-75a56ab97b5e/scan_result.json",
  "resultCount": 1,
  "tool": "ssafer-cli",
  "toolVersion": "1.4.0",
  "payloadHash": null,
  "queuedAt": "2026-05-06T04:00:00Z"
}
```

검증 규칙:

| 필드 | 규칙 |
| --- | --- |
| `messageType` | `SCAN_REQUEST` |
| `messageVersion` | `1` |
| `taskType` | `SCAN_REQUEST` |
| `taskId` | Spring Boot `agent_tasks.id` |
| `scanId` | Spring Boot `scans.id`, Long 기반 ID |
| `rawResultPath` | `s3://bucket/key` 형식 |

주의: raw `scan_result.json` 내부의 `scanId`는 CLI 원본 UUID입니다. Spring Boot의 numeric `scanId`와 같은 값으로 취급하지 않습니다.

## 4. FastAPI Analyze API

### Endpoint

```http
POST /analyze
Content-Type: application/json
```

### Worker -> FastAPI 요청

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

필드:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `taskId` | number | 예 | Spring Boot `agent_tasks.id` |
| `agentId` | number | 예 | 작업을 처리하는 agent ID |
| `projectId` | number | 예 | scan이 속한 project ID |
| `scanId` | number | 예 | Spring Boot `scans.id` |
| `rawResultPath` | string | 예 | 분석할 raw `scan_result.json` S3 URI |
| `analysisResultPath` | string | 예 | 생성된 `analysis_result.json` 업로드 대상 S3 URI |

현재 기존 로컬 테스트 호환을 위해 아래 필드도 유지합니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `scan_result_path` | string | 로컬 `scan_result.json` 경로 |
| `analysis_result_path` | string | 로컬 `analysis_result.json` 저장 경로 |
| `scan_result` | object 또는 null | inline scan result DTO |

### FastAPI 성공 응답

```json
{
  "status": "completed",
  "message": null,
  "stage": null,
  "finding_id": null,
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 3,
  "invalid_finding_count": 0,
  "result_count": 3,
  "invalid_findings": []
}
```

현재 FastAPI 내부 응답은 기존 구현과 호환되도록 snake_case를 유지합니다.
Worker는 이 응답을 받아 Spring Boot 콜백 규격의 camelCase로 변환합니다.

응답 필드:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `status` | string | `completed` 또는 `completed_with_invalid_findings` |
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

### FastAPI 실패 응답

```json
{
  "status": "failed",
  "error_code": "ANALYSIS_INPUT_ERROR",
  "message": "scan_result.json file not found: missing.json",
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

HTTP status:

| HTTP status | stage | 의미 |
| --- | --- | --- |
| `400` | `input` | 요청 입력, 파일 로딩, JSON 파싱, scan result 검증 실패 |
| `502` | `explain` | explanation 생성 실패 |
| `502` | `fix` | fix 생성 실패 |
| `502` | `analysis` | 일반 분석 파이프라인 실패 |
| `500` | `output` | analysis result 생성, 검증, 저장 실패 |

실패 응답 필드:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `status` | string | 항상 `failed` |
| `error_code` | string | FastAPI 분석 실패 표준 코드 |
| `message` | string | 실패 원인 메시지 |
| `stage` | string | 실패 단계 |
| `finding_id` | string 또는 null | 특정 finding 처리 중 실패한 경우 finding ID |
| `scan_result_path` | string | 입력 scan result 경로 또는 출처 |
| `analysis_result_path` | string 또는 null | 결과 저장 경로 |
| `finding_count` | number | raw finding 전체 개수 |
| `valid_finding_count` | number | 분석 대상 finding 개수 |
| `invalid_finding_count` | number | 검증 실패로 제외된 finding 개수 |
| `result_count` | number | 생성된 분석 결과 개수 |
| `invalid_findings` | array | 제외된 finding 목록 |

## 5. Spring Boot 상태 콜백 API

Worker는 메시지를 consume한 뒤 Spring Boot에 처리 상태를 보고합니다.

### ACKED/RUNNING 상태 보고

```http
PATCH /api/v1/internal/agent-tasks/{taskId}/status
Content-Type: application/json
```

요청:

```json
{
  "agentId": 10,
  "scanId": 5,
  "status": "RUNNING",
  "message": null,
  "errorCode": null,
  "occurredAt": "2026-05-06T04:00:10Z"
}
```

필드:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `agentId` | number | 예 | 요청 agent ID |
| `scanId` | number | 예 | Spring Boot `scans.id` |
| `status` | string | 예 | `ACKED`, `RUNNING`, `FAILED`, `CANCELED` |
| `message` | string 또는 null | 아니오 | 상태 설명 또는 실패 메시지 |
| `errorCode` | string 또는 null | 아니오 | 실패 시 표준 에러 코드 |
| `occurredAt` | string 또는 null | 아니오 | ISO 8601 발생 시각 |

Spring Boot 처리:

| 요청 status | agent_tasks 반영 | scan 반영 |
| --- | --- | --- |
| `ACKED` | `SENT -> ACKED`, `acked_at` 기록 | `QUEUED` 유지 |
| `RUNNING` | `ACKED -> RUNNING`, `started_at` 기록 | `RUNNING` |
| `FAILED` | 현재 상태 -> `FAILED`, `completed_at`, `failure_reason` 기록 | `FAILED` |
| `CANCELED` | 현재 상태 -> `CANCELED`, `completed_at`, `failure_reason` 기록 | `CANCELED` |

성공 응답:

```json
{
  "success": true,
  "message": "Agent task status updated.",
  "data": {
    "taskId": 123,
    "agentId": 10,
    "scanId": 5,
    "status": "RUNNING"
  }
}
```

실패 응답 예시:

```json
{
  "success": false,
  "message": "AgentTask status transition is not allowed: SENT -> RUNNING",
  "data": null
}
```

권장 HTTP status:

| HTTP status | 상황 |
| --- | --- |
| `200` | 상태 반영 성공 |
| `400` | 요청 body 검증 실패 또는 허용되지 않는 상태 전이 |
| `401` | 내부 인증 실패 |
| `403` | 요청 agent와 token 매핑 불일치 |
| `404` | task, agent, scan을 찾을 수 없음 |

### 완료 결과 보고

```http
POST /api/v1/internal/agent-tasks/{taskId}/result
Content-Type: application/json
```

성공 요청:

```json
{
  "agentId": 10,
  "scanId": 5,
  "status": "SUCCEEDED",
  "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
  "findingCount": 3,
  "validFindingCount": 3,
  "invalidFindingCount": 0,
  "resultCount": 3,
  "durationMs": 73000
}
```

실패 요청:

```json
{
  "agentId": 10,
  "scanId": 5,
  "status": "FAILED",
  "analysisResultPath": null,
  "findingCount": 0,
  "validFindingCount": 0,
  "invalidFindingCount": 0,
  "resultCount": 0,
  "errorCode": "S3_DOWNLOAD_FAILED",
  "message": "Failed to download raw result from S3.",
  "stage": "S3_DOWNLOAD",
  "retryable": true,
  "durationMs": 5000
}
```

필드:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `agentId` | number | 예 | 요청 agent ID |
| `scanId` | number | 예 | Spring Boot `scans.id` |
| `status` | string | 예 | `SUCCEEDED`, `FAILED`, `CANCELED` |
| `analysisResultPath` | string 또는 null | 성공 시 예 | 분석 결과 S3 URI |
| `findingCount` | number | 아니오 | raw finding 수 |
| `validFindingCount` | number | 아니오 | 분석 대상 finding 수 |
| `invalidFindingCount` | number | 아니오 | 제외된 finding 수 |
| `resultCount` | number | 아니오 | 생성된 분석 결과 수 |
| `errorCode` | string 또는 null | 실패 시 예 | 표준 에러 코드 |
| `message` | string 또는 null | 실패 시 예 | 실패 메시지 |
| `stage` | string 또는 null | 실패 시 예 | 실패 단계 |
| `retryable` | boolean | 아니오 | 재시도 가능한 실패 여부 |
| `durationMs` | number 또는 null | 아니오 | 처리 시간 |

Spring Boot 처리:

| 요청 status | agent_tasks 반영 | scan 반영 |
| --- | --- | --- |
| `SUCCEEDED` | `RUNNING -> SUCCEEDED`, `completed_at` 기록 | `DONE` |
| `FAILED` | `RUNNING -> FAILED`, `failure_reason` 기록 | `FAILED` |
| `CANCELED` | 현재 상태 -> `CANCELED`, `failure_reason` 기록 | `CANCELED` |

성공 응답:

```json
{
  "success": true,
  "message": "Agent task result received.",
  "data": {
    "taskId": 123,
    "agentId": 10,
    "scanId": 5,
    "status": "SUCCEEDED",
    "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json"
  }
}
```

실패 응답 예시:

```json
{
  "success": false,
  "message": "Analysis result path is required when status is SUCCEEDED.",
  "data": null
}
```

권장 HTTP status:

| HTTP status | 상황 |
| --- | --- |
| `200` | 결과 반영 성공 |
| `400` | 요청 body 검증 실패, 필수 결과 필드 누락, 허용되지 않는 상태 전이 |
| `401` | 내부 인증 실패 |
| `403` | 요청 agent와 token 매핑 불일치 |
| `404` | task, agent, scan을 찾을 수 없음 |

## 6. 상태 전이 기준

| 시점 | agent_tasks.task_status | scan.status |
| --- | --- | --- |
| Spring Boot task 생성 직후 | `PENDING` | 기존 상태 |
| RabbitMQ publish 성공 직후 | `SENT` | `QUEUED` |
| Worker 메시지 수신 확인 | `ACKED` | `QUEUED` |
| Worker 실제 처리 시작 | `RUNNING` | `RUNNING` |
| Worker 처리 성공 | `SUCCEEDED` | `DONE` |
| Worker 처리 실패 | `FAILED` | `FAILED` |
| 취소 | `CANCELED` | `CANCELED` |

## 7. 표준 에러 코드

| errorCode | 의미 | retryable 기본값 |
| --- | --- | --- |
| `INVALID_REQUEST` | 요청 payload 검증 실패 | false |
| `RAW_RESULT_NOT_FOUND` | raw result S3 객체 없음 | false |
| `S3_DOWNLOAD_FAILED` | S3 다운로드 실패 | true |
| `S3_UPLOAD_FAILED` | S3 업로드 실패 | true |
| `LLM_TIMEOUT` | LLM 호출 timeout | true |
| `LLM_CALL_FAILED` | LLM 호출 실패 | true |
| `ANALYSIS_INPUT_ERROR` | scan result 입력 처리 실패 | false |
| `ANALYSIS_PIPELINE_ERROR` | 일반 분석 실패 | false |
| `ANALYSIS_OUTPUT_ERROR` | 결과 생성 또는 저장 실패 | false |
| `CALLBACK_FAILED` | Spring Boot 콜백 실패 | true |
| `UNKNOWN_ERROR` | 분류되지 않은 실패 | false |

## 8. 로깅 필드

Worker와 FastAPI는 로그에 아래 필드를 포함합니다.

```text
scanId
taskId
agentId
projectId
stage
status
errorCode
durationMs
```

권장 stage:

```text
MESSAGE_CONSUMED
TASK_ACKED
TASK_RUNNING
S3_DOWNLOAD
ANALYZE_REQUEST
LLM_ANALYSIS
S3_UPLOAD
SPRING_CALLBACK
TASK_COMPLETED
TASK_FAILED
```
