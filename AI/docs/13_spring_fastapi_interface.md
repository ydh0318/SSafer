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
Worker -> FastAPI POST /analyze 호출
FastAPI -> raw result 다운로드/분석/result 생성
Worker -> Spring Boot RUNNING, DONE 또는 FAILED 분석 상태 콜백
Spring Boot -> scan, agent_tasks 상태 반영 및 analysis result 비동기 적재
```

AI 프로젝트 실행 단위:

| 실행 단위 | 명령 | 역할 |
| --- | --- | --- |
| FastAPI | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | `/analyze` 요청 수신, S3 raw 분석, S3 result 업로드 |
| Worker | `python -m app.worker.async_consumer` | RabbitMQ consume, Spring Boot 상태/결과 콜백, FastAPI `/analyze` 호출 |

FastAPI와 Worker는 같은 `AI/` 코드베이스에 있지만 별도 프로세스로 실행합니다.

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
  "messageVersion": 2,
  "taskType": "SCAN_REQUEST",
  "taskId": 123,
  "agentId": 10,
  "projectId": 2,
  "scanId": 5,
  "scanType": "PROJECT_FILE",
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
| `messageVersion` | `2` |
| `taskType` | `SCAN_REQUEST` |
| `taskId` | Spring Boot `agent_tasks.id` |
| `scanId` | Spring Boot `scans.id`, Long 기반 ID |
| `scanType` | `PROJECT_FILE` 또는 `SERVER_AUDIT` |
| `rawResultPath` | `s3://bucket/key` 형식 |

주의: raw `scan_result.json` 내부의 `scanId`는 CLI 원본 UUID입니다. Spring Boot의 numeric `scanId`와 같은 값으로 취급하지 않습니다.

Worker 처리 규칙:

| 단계 | 동작 |
| --- | --- |
| 메시지 검증 | `messageType`, `messageVersion`, `taskType`, `rawResultPath` 검증 |
| 분석 시작 | Spring Boot에 `RUNNING` 분석 시작 콜백 |
| 분석 요청 | FastAPI `/analyze` 호출 |
| 성공 | Spring Boot에 `DONE` 분석 완료 콜백 후 RabbitMQ ack |
| 실패 | Spring Boot에 `FAILED` 분석 완료 콜백 후 RabbitMQ ack |
| 메시지 형식 오류 | RabbitMQ nack, requeue false |
| 영구 HTTP 실패 | RabbitMQ nack, requeue false |
| 일시 실패 또는 미분류 예외 | RabbitMQ nack, requeue true |

Worker requeue 정책:

| 실패 유형 | 처리 |
| --- | --- |
| Spring/FastAPI HTTP `400`, `401`, `403`, `404`, `409` | `requeue=false` |
| Spring/FastAPI HTTP `408`, `429`, `5xx` | `requeue=true` |
| 네트워크 오류, timeout, status code 없는 HTTP client 오류 | `requeue=true` |
| 예상하지 못한 예외 | `requeue=true` |

`409 Conflict`는 이미 완료되었거나 현재 상태와 충돌하는 작업일 가능성이 높으므로 재시도하지 않습니다. 특히 이미 `DONE` 또는 `FAILED` 처리된 scan에 같은 RabbitMQ 메시지가 재전달될 때 `RUNNING -> 409 -> requeue` 반복이 발생하지 않도록 `requeue=false`로 처리합니다.

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

S3 연동 방식:

| 항목 | 방식 |
| --- | --- |
| raw result 입력 | `rawResultPath`의 S3 객체를 메모리로 읽어 JSON 파싱 |
| analysis result 출력 | 생성된 JSON을 `analysisResultPath` S3 객체로 직접 업로드 |
| 로컬 파일 저장 | Worker 연동 흐름에서는 사용하지 않음 |

### 응답

FastAPI 응답은 snake_case이며 성공 시 `status="completed"`, 실패 시 `status="failed"` + HTTP 4xx/5xx(`input`→400, `explain`/`fix`/`analysis`→502, `output`→500)입니다. 응답 필드·HTTP status·에러 코드 전체 표는 `12_analyze_api.md` §4~§5를 참고합니다.

Worker는 이 FastAPI 응답을 받아 Spring Boot 콜백 규격(camelCase, 5절)으로 변환합니다.

## 5. Spring Boot 분석 상태 콜백 API

Worker는 FastAPI 분석 시작 전 Spring Boot에 `RUNNING`을 먼저 알리고, 분석이 끝난 뒤 `DONE` 또는 `FAILED` 최종 결과를 보고합니다.

### Endpoint

```http
POST /api/v1/internal/scans/{scanId}/analysis-results
Content-Type: application/json
X-Worker-Secret: <worker-secret>
```

### 진행 시작 요청

```json
{
  "taskId": 123,
  "status": "RUNNING",
  "progressStep": "analysis_started",
  "analysisResultPath": null,
  "startedAt": "2026-05-06T04:00:00",
  "completedAt": null,
  "lastUpdatedAt": "2026-05-06T04:00:00"
}
```

### 성공 요청

```json
{
  "taskId": 123,
  "status": "DONE",
  "progressStep": "analysis_completed",
  "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
  "startedAt": "2026-05-06T04:00:00",
  "completedAt": "2026-05-06T04:05:00",
  "lastUpdatedAt": "2026-05-06T04:05:00"
}
```

### 실패 요청

```json
{
  "taskId": 123,
  "status": "FAILED",
  "progressStep": "analysis_failed",
  "stage": "input",
  "errorCode": "ANALYSIS_INPUT_ERROR",
  "failureReason": "ANALYSIS_INPUT_ERROR: FastAPI analysis failed: Failed to download scan_result.json from S3. (stage=input)",
  "analysisResultPath": null,
  "startedAt": "2026-05-06T04:00:00",
  "completedAt": "2026-05-06T04:05:00",
  "lastUpdatedAt": "2026-05-06T04:05:00"
}
```

Path variable:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `scanId` | number | 예 | Spring Boot `scans.id` |

Request body:

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `taskId` | number | 예 | 완료 처리할 Spring Boot `agent_tasks.id` |
| `status` | string | 아니오 | `RUNNING`, `DONE`, `FAILED`. 생략 시 Spring Boot에서 `DONE` 처리 |
| `progressStep` | string 또는 null | 아니오 | `analysis_started`, `analysis_completed`, `analysis_failed` |
| `stage` | string 또는 null | 실패 시 예 | 실패 단계. 예: `input`, `analysis`, `output`, `explain`, `fix` |
| `errorCode` | string 또는 null | 실패 시 예 | 표준 에러 코드 |
| `failureReason` | string 또는 null | 실패 시 예 | `{errorCode}: {실패 위치}: {실패 사유}` 형식의 실패 사유. 현재 호환성을 위해 `(stage=...)`도 포함 |
| `analysisResultPath` | string 또는 null | 성공 시 예 | S3에 저장된 analysis result 경로 |
| `startedAt` | string 또는 null | 아니오 | Worker 분석 시작 시각 |
| `completedAt` | string 또는 null | 아니오 | Worker 분석 완료 시각 |
| `lastUpdatedAt` | string 또는 null | 아니오 | 마지막 상태 갱신 시각 |

Spring Boot 처리:

| 요청 status | 처리 |
| --- | --- |
| `RUNNING` | Spring Boot가 task와 scan을 분석 진행 중 상태로 반영 |
| `DONE` | Spring Boot가 scan/task를 식별하고 analysisResultPath의 S3 JSON을 비동기 적재 |
| `FAILED` | Spring Boot가 실패 사유를 기록하고 scan/task를 실패 상태로 반영 |

성공 응답:

```json
{
  "scanId": 5,
  "projectId": 2,
  "scanMode": "AGENT",
  "status": "RUNNING",
  "analysisResultPath": "s3://ssafer-scan-storage-dev/analysis/5/analysis_result.json",
  "requestedAt": "2026-05-06T03:55:00",
  "lastUpdatedAt": "2026-05-06T04:05:00"
}
```

권장 HTTP status:

| HTTP status | 상황 |
| --- | --- |
| `200` | 콜백 접수 성공 |
| `400` | 요청 body 검증 실패, 필수 필드 누락 |
| `401` | 내부 인증 실패 |
| `404` | scan 또는 agent task를 찾을 수 없음 |
| `409` | 현재 scan/task 상태에서 콜백 반영 불가 |
| `500` | Spring Boot 내부 오류 |

## 6. 상태 전이 기준

| 시점 | agent_tasks.task_status | scan.status |
| --- | --- | --- |
| Spring Boot task 생성 직후 | `PENDING` | 기존 상태 |
| RabbitMQ publish 성공 직후 | `SENT` | `QUEUED` |
| Worker RUNNING 콜백 접수 | 필요 시 `SENT -> ACKED -> RUNNING` | `RUNNING` |
| Worker DONE 콜백 접수 | 결과 적재 대기 | `RUNNING` |
| 분석 결과 비동기 적재 성공 | `SUCCEEDED` | `DONE` |
| Worker 실패 콜백 접수 | 필요 시 `SENT -> ACKED -> RUNNING -> FAILED` | `FAILED` |
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

`durationMs`는 Spring Boot 콜백 payload에는 포함하지 않고, AI 서버와 Worker 로그에서 확인합니다.

권장 stage:

```text
MESSAGE_CONSUMED
ANALYZE_REQUEST
LOAD_INPUT
S3_DOWNLOAD
PREPARE_INPUT
ANALYZE_FINDINGS
FINDING_ANALYSIS
EXPLAIN
FIX
SAVE_RESULT
SPRING_CALLBACK
TASK_COMPLETED
TASK_FAILED
```

FastAPI `/analyze` timeout을 추적할 때는 `durationMs`와 stage를 함께 봅니다. `S3_DOWNLOAD`는 raw 결과 다운로드, `PREPARE_INPUT`은 finding 파싱/검증, `EXPLAIN`과 `FIX`는 finding별 LLM 호출, `SAVE_RESULT`는 분석 결과 저장 또는 S3 업로드 시간을 의미합니다. Worker의 `WORKER_HTTP_TIMEOUT_SECONDS`는 이 전체 `/analyze` 요청 시간을 감싸므로, 특정 stage가 오래 걸리면 해당 stage 로그가 timeout 원인 분석의 기준이 됩니다.

## 9. Worker 환경변수

Worker가 읽는 환경변수 전체 목록·기본값은 `05_configuration.md` 12절(Worker)을 참고합니다. 범주별 핵심만 정리하면:

- 브로커 연결: `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VIRTUAL_HOST`, `AGENT_TASK_SCAN_REQUEST_QUEUE`
- 호출 대상: `FASTAPI_BASE_URL`, `SPRING_BASE_URL`, `SPRING_API_SECRET`
- S3 업로드: `APP_ANALYSIS_RESULT_S3_BUCKET`, `WORKER_ANALYSIS_RESULT_PREFIX`
- 동작/타임아웃: `WORKER_HTTP_TIMEOUT_SECONDS`, `WORKER_MAX_CONCURRENCY`, `WORKER_REDELIVERY_CAP`, `OLLAMA_TIMEOUT_SECONDS`

## 10. 로컬 실행

Worker와 FastAPI는 별도 프로세스로 실행하며, 사이에 RabbitMQ 브로커가 필요합니다.

### RabbitMQ 브로커

로컬에서는 Docker로 띄우는 것이 가장 간단합니다(관리 콘솔 포함 이미지).

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

- `5672`: AMQP 포트. Worker가 이 포트로 연결합니다.
- `15672`: 관리 콘솔. 브라우저에서 `http://127.0.0.1:15672` (기본 계정 `guest`/`guest`).

운영 환경 브로커는 Infra 저장소의 docker-compose로 관리합니다.

### Worker 실행

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m app.worker.async_consumer
```

Worker는 `AGENT_TASK_SCAN_REQUEST_QUEUE` queue를 consume하고, FastAPI `/analyze`를 호출한 뒤 Spring Boot로 콜백합니다. 브로커 연결 정보는 `RABBITMQ_*` 환경변수로 지정합니다(9절).

### FastAPI 실행

Worker가 호출할 FastAPI 서버도 함께 실행합니다(상세는 `01_fastapi_setup.md`).

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 최소 점검 순서

```text
1. RabbitMQ 브로커 실행 (5672 오픈)
2. FastAPI 서버 실행 (FASTAPI_BASE_URL과 일치)
3. Worker 실행
4. queue에 SCAN_REQUEST 메시지 publish → Worker consume 로그 확인
```

Worker 의존성(`aio-pika` 등)은 `requirements.txt`에 포함되어 있습니다. 메시지/콜백 계약은 3~7절을 참고합니다.
