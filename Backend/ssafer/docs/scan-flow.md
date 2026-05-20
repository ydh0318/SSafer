# Scan Flow

이 문서는 Web App multipart 업로드와 CLI presigned 업로드 기반 스캔이 백엔드에서 어떻게 처리되는지 정리합니다.

## CLI Presigned Upload Flow

```text
CLI / Agent
  -> POST /api/v1/scans
Backend
  -> scan metadata 저장
  -> S3 presigned upload URL 발급
CLI / Agent
  -> S3 scan_result.json 업로드
  -> POST /api/v1/scans/{scanId}/raw-results
Backend
  -> raw result 검증
  -> worker_jobs 생성
  -> RabbitMQ publish
Worker
  -> RabbitMQ consume
  -> S3 scan_result.json download
  -> FastAPI / AI agent 분석
  -> S3 analysis_result.json upload
  -> POST /api/v1/internal/scans/{scanId}/analysis-results
Backend
  -> callback 상태 반영
  -> analysis_result.json 읽기
  -> scan_nodes, scan_findings 적재
  -> scan DONE/FAILED 전환
  -> SSE event publish
```

## Web Multipart Upload Flow

```text
Web App
  -> POST /api/v1/scans/upload multipart/form-data
Backend
  -> project find-or-create
  -> scan metadata 저장
  -> multipart file 임시 저장
  -> upload scanner 실행
  -> scan_result.json 생성
  -> S3 scan_result.json 업로드
  -> worker_jobs 생성
  -> RabbitMQ publish
Worker
  -> RabbitMQ consume
  -> S3 scan_result.json download
  -> FastAPI / AI agent 분석
  -> S3 analysis_result.json upload
  -> POST /api/v1/internal/scans/{scanId}/analysis-results
Backend
  -> callback 상태 반영
  -> analysis_result.json 읽기
  -> scan_nodes, scan_findings 적재
  -> scan DONE/FAILED 전환
  -> SSE event publish
```

## 1. CLI Scan Registration

CLI 또는 Agent 계열 클라이언트는 `POST /api/v1/scans`로 scan을 등록합니다.

Backend는 다음 작업을 수행합니다.

- 인증 주체의 프로젝트 접근 권한 확인
- `scans` row 생성
- S3 raw result object path 생성
- raw result 업로드용 presigned URL 발급

응답에는 `scanId`, `projectId`, `status`, `rawResultPath`, `rawUploadUrl`이 포함됩니다.

## 2. CLI Raw Result Upload Report

CLI 또는 Agent 계열 클라이언트는 presigned URL로 `scan_result.json`을 S3에 업로드한 뒤 `POST /api/v1/scans/{scanId}/raw-results`를 호출합니다.

Backend는 다음 작업을 수행합니다.

- scan 소유권과 상태 검증
- S3 raw result object 존재 여부 검증
- payload hash 등 업로드 결과 검증
- scan 상태를 raw uploaded 단계로 전환
- 업로드 분석 작업 dispatch

## 3. Web Multipart Upload

Web App은 `POST /api/v1/scans/upload`로 multipart file을 업로드합니다.

Backend는 다음 작업을 수행합니다.

- 프로젝트 이름 기준 find-or-create
- scan row 생성
- 업로드 파일 검증
- 임시 workspace에 파일 저장
- upload scanner 실행
- `scan_result.json` 생성
- raw result를 S3에 업로드
- scan 상태를 raw uploaded 단계로 전환
- 업로드 분석 작업 dispatch

Web multipart 흐름에서는 Web App이 presigned URL로 직접 S3에 업로드하지 않습니다. Backend가 multipart file을 받아 스캔 결과를 만들고 S3 업로드까지 수행합니다.

## 4. Worker Job Dispatch

업로드 분석 dispatch 흐름은 upload analysis 작업을 준비합니다.

- `worker_jobs` row 생성
- Worker가 사용할 message payload 생성
- payload JSON 저장
- scan 상태를 `QUEUED`로 전환
- RabbitMQ exchange에 scan request publish

RabbitMQ publish 실패 시 worker job은 canceled 처리되고 scan은 raw uploaded 단계로 되돌립니다. published 상태에서 오래 머무는 job은 scheduler가 재발행을 시도합니다.

## 5. Worker Callback

Worker는 분석 진행 상태를 `POST /api/v1/internal/scans/{scanId}/analysis-results`로 보고합니다.

지원하는 callback 상태는 다음과 같습니다.

| 상태 | 의미 |
| --- | --- |
| `RUNNING` | Worker가 분석을 시작함 |
| `DONE` | 분석 결과가 S3에 업로드됨 |
| `FAILED` | 분석 실패 |

`DONE` callback에는 `analysisResultPath`가 필요합니다. Backend는 callback을 받은 시점에 결과 파일 경로를 저장하고, 실제 findings 적재는 별도 ingestion job으로 처리합니다.

## 6. Analysis Result Ingestion

`WorkerAnalysisResultPersistenceService`는 S3의 `analysis_result.json`을 읽어 DB에 반영합니다.

- analysis result JSON 로드
- scan node 생성 또는 재사용
- finding fingerprint 기준 기존 finding 갱신 또는 신규 finding 생성
- patch payload가 있는 경우 finding에 보존
- worker job 성공 처리
- scan 상태를 DONE으로 전환
- SSE 완료 이벤트 발행

적재 중 예외가 발생하면 별도 transaction에서 worker job과 scan을 FAILED로 마킹합니다.

## 7. Status Notification

Frontend는 `/api/v1/scan-events/subscribe`를 통해 scan 상태 변경을 SSE로 구독할 수 있습니다. Backend는 DONE/FAILED 같은 최종 상태 변경 시 이벤트를 발행합니다.

Local Agent는 SSE가 아니라 WebSocket 연결과 internal agent task API를 사용합니다.
