# API Authentication

SSAFER 백엔드는 호출 주체에 따라 다른 인증 방식을 사용합니다. 일반 사용자 API, guest API, Local Agent API, Worker callback API를 분리하여 보안 경계를 명확히 합니다.

## Authentication Types

| 주체 | 인증 방식 | 주요 용도 |
| --- | --- | --- |
| User | JWT access token | 일반 `/api/**` 사용자 API 호출 |
| Guest | guest token | guest 진입 후 제한된 프로젝트/스캔 접근 |
| Local Agent | agent token | `/api/v1/internal/agents/**`, Agent WebSocket |
| Worker | worker secret | `/api/v1/internal/scans/*/analysis-results` callback |
| Public | 없음 | login, signup, email verification, Swagger, healthcheck |

## Security Filter Chains

`SecurityConfig`는 경로별로 별도 filter chain을 구성합니다.

| Order | 대상 경로 | 필터 |
| --- | --- | --- |
| 1 | `/api/v1/internal/agents/**` | `AgentTokenAuthenticationFilter` |
| 2 | `/api/v1/internal/scans/*/analysis-results` | `WorkerSecretAuthenticationFilter` |
| 3 | 그 외 API | `JwtAuthenticationFilter` |

각 custom filter는 servlet filter로 자동 등록되지 않도록 `FilterRegistrationBean#setEnabled(false)`로 비활성화하고, Spring Security chain 내부에서만 실행합니다.

## Public Endpoints

다음 경로는 JWT 없이 접근 가능합니다.

- `GET /actuator/health`
- Swagger/OpenAPI: `/swagger-ui/**`, `/v3/api-docs/**`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/oauth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/email/send-code`
- `POST /api/v1/auth/email/verify-code`
- `POST /api/v1/auth/password-reset/send-code`
- `POST /api/v1/auth/password-reset/verify-code`
- `POST /api/v1/auth/password-reset/complete`
- `POST /api/v1/users`
- `GET /api/v1/users/check-email`
- `GET /api/v1/users/check-nickname`
- `POST /api/v1/guests/enter`

그 외 `/api/**` 요청은 기본적으로 인증이 필요합니다.

## User JWT

일반 사용자 API는 `Authorization: Bearer <access-token>` 헤더를 사용합니다. access token은 짧게 유지하고, refresh token은 Redis에 TTL 기반으로 저장합니다.

인증된 요청에서는 `CurrentActorProvider`를 통해 현재 호출 주체를 조회하고, service 계층에서 프로젝트/스캔 접근 권한을 검증합니다.

## Agent Token

Local Agent는 프로젝트 단위로 발급된 agent token을 사용합니다. Agent token은 internal agent API와 WebSocket handshake에서 사용됩니다.

주요 경로는 다음과 같습니다.

- `GET /api/v1/internal/agents/{agentId}/tasks`
- `POST /api/v1/internal/agents/{agentId}/tasks/{taskId}/result`
- `WebSocket /ws/v1/internal/agents/connect`

Agent token은 사용자 JWT와 분리되어 있으며, agent id와 token의 매칭 여부를 검증합니다.

## Worker Secret

Worker는 분석 상태 callback을 보낼 때 worker secret을 사용합니다.

대상 경로:

```text
POST /api/v1/internal/scans/{scanId}/analysis-results
```

이 API는 일반 JWT가 아니라 worker 전용 secret으로만 인증됩니다. callback body의 task id는 worker job id로 해석하며, scan과 worker job이 매칭되는지 검증합니다.

## S3 Presigned URL

S3 presigned URL 요청 자체는 Backend 인증 API를 통해 발급됩니다. 실제 S3 `PUT` 또는 `GET` 요청에는 SSAFER JWT를 붙이지 않습니다. URL에 포함된 서명과 만료 시간이 S3 접근 권한을 대신합니다.
