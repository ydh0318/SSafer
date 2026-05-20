# Backend Architecture

SSAFER 백엔드는 사용자, 프로젝트, 스캔 상태를 관리하고 외부 컴포넌트와의 연동을 오케스트레이션합니다. 직접 긴 분석 작업을 수행하기보다 scan metadata 저장, S3 presigned URL 발급, RabbitMQ 작업 발행, Worker callback 수신, 분석 결과 적재를 담당합니다.

## Runtime Components

| 컴포넌트 | 역할 |
| --- | --- |
| Spring Boot | API 제공, 인증/인가, scan/task 상태 관리, 결과 적재, 이벤트 발행 |
| PostgreSQL | users, projects, scans, findings, agents, worker_jobs 등 영속 데이터 저장 |
| Redis | refresh token, 이메일 인증 코드, 비밀번호 재설정 코드 등 TTL 기반 데이터 저장 |
| RabbitMQ | 업로드 스캔 분석 작업을 Worker로 전달 |
| AWS S3 | `scan_result.json`, `analysis_result.json` 저장 |
| Worker | RabbitMQ 메시지를 소비하고 FastAPI AI agent를 호출한 뒤 Spring callback 호출 |
| FastAPI AI agent | `scan_result.json`을 분석하고 `analysis_result.json`을 생성 |
| Local Agent | WebSocket으로 연결되어 scan/patch task를 수신하고 결과를 보고 |

## Backend Responsibilities

- 회원가입, 로그인, OAuth, 이메일 인증, 비밀번호 재설정
- 프로젝트 생성, 조회, 삭제 및 프로젝트 접근 권한 검증
- 스캔 등록과 raw result 업로드 URL 발급
- CLI raw 업로드 완료 보고 및 Web multipart 업로드 처리
- Worker 분석 작업 발행과 재발행
- Worker callback 기반 scan 상태 전이
- S3 분석 결과 다운로드, findings 적재, scan 완료 처리
- SSE 기반 scan 상태 변경 알림
- Local Agent token 발급, WebSocket 연결, task polling/result report 처리

## Package Layout

```text
com.ssafer
  agent       Local Agent 연결, token, task, WebSocket
  auth        로그인, OAuth, refresh token, 이메일/비밀번호 인증 코드
  global      공통 응답, 예외 처리, 보안 필터, 로깅, 설정
  guest       guest 진입과 guest token
  project     프로젝트 관리와 접근 권한 검증
  scan        스캔 등록, 업로드, 상태 조회, findings, Worker callback, S3 연동
  user        회원, 프로필, 소셜 계정, 탈퇴
  worker      worker_jobs 도메인 모델
```

각 도메인은 대체로 `api`, `application`, `domain`, `infrastructure` 계층으로 분리합니다.

| 계층 | 역할 |
| --- | --- |
| `api` | Controller, request/response DTO |
| `application` | 유스케이스 서비스, 상태 전이, 이벤트 발행 |
| `domain` | Entity, enum, repository interface |
| `infrastructure` | S3, Redis, RabbitMQ, OAuth client 등 외부 연동 구현 |

## Async Processing Model

업로드 스캔 분석은 동기 HTTP 요청 안에서 끝내지 않습니다. Backend는 scan과 worker job을 저장하고 RabbitMQ에 작업을 발행합니다. Worker는 메시지를 consume하여 분석을 수행하고, 진행 상태를 internal callback API로 보고합니다.

```text
Backend
  -> worker_jobs 저장
  -> RabbitMQ publish
  -> Worker consume
  -> Worker callback
  -> Backend result ingestion
```

RabbitMQ 발행 실패나 오래된 published job은 `WorkerJobRepublishScheduler`가 재발행 대상으로 처리합니다.

## State And Notification

scan 상태는 PostgreSQL에 저장하며, 주요 전이는 application service에서 row lock 기반으로 처리합니다. DONE 또는 FAILED 같은 최종 상태 전이는 SSE 이벤트로 발행되어 클라이언트가 `/api/v1/scan-events/subscribe`에서 구독할 수 있습니다.
