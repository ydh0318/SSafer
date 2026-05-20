# n8n MR Review Orchestrator

`S14P31B105-160` 기준 n8n을 GitLab MR 자동 리뷰 오케스트레이터로 사용하는 설계 문서입니다.

## 목적

n8n은 SSAfer 제품 API 요청 경로에 포함되는 서비스가 아니라 팀 내부 개발 품질 향상을 위한 DevOps automation 도구입니다.

목표는 GitLab Merge Request 이벤트를 받아 자동 리뷰 흐름을 오케스트레이션하는 것입니다.

```text
GitLab Merge Request event
→ n8n Webhook trigger
→ MR metadata/diff 조회
→ Review Agent 또는 LLM API 호출
→ GitLab MR comment 작성
→ 필요 시 Jira 기록
```

## Webhook 분리 기준

Jenkins와 n8n은 서로 다른 Webhook 목적을 가집니다.

| 대상 | 이벤트 | 목적 |
| --- | --- | --- |
| Jenkins | push 또는 merge to develop | build, image push, deploy |
| n8n | merge request event | 자동 리뷰, 알림, 외부 도구 orchestration |

GitLab Webhook을 등록할 때 배포용 Webhook과 리뷰용 Webhook을 분리합니다.

## n8n endpoint

n8n은 NGINX 뒤에서 `/n8n/` 경로로 노출합니다.

```text
https://<LEGACY_DEPLOY_DOMAIN>/n8n/
```

n8n Webhook node를 만들면 test/production URL이 생성됩니다. GitLab MR Webhook에는 production URL을 사용합니다.

예시:

```text
https://<LEGACY_DEPLOY_DOMAIN>/n8n/webhook/gitlab-mr-review
```

정확한 URL은 n8n workflow의 Webhook node에서 복사합니다.

## GitLab Webhook 설정

GitLab 프로젝트에서 아래로 이동합니다.

```text
Settings -> Webhooks
```

등록 값:

```text
URL: n8n Webhook node의 production URL
Secret token: n8n workflow에서 검증할 공유 secret
Trigger: Merge request events
SSL verification: HTTPS 구성 후 활성화
```

배포용 Jenkins Webhook과 혼동하지 않습니다.

```text
Jenkins: http://<LEGACY_DEPLOY_DOMAIN>:9090/project/ssafer-prod-deploy
n8n: https://<LEGACY_DEPLOY_DOMAIN>/n8n/webhook/...
```

## Workflow 초안

1. Webhook Trigger
   - GitLab Merge Request event 수신
   - secret token 검증

2. Event Filter
   - action이 open, update, reopen인 경우만 리뷰
   - draft MR은 skip 가능
   - target branch가 develop이 아니면 skip 가능

3. GitLab MR 조회
   - project id
   - merge request iid
   - title, description, source branch, target branch
   - changed files 또는 diff

4. Review Agent 호출
   - MR metadata와 diff 전달
   - 리뷰 결과 markdown 수신

5. GitLab MR comment 작성
   - 자동 리뷰 결과를 MR discussion/comment로 등록

6. Optional Jira Record
   - 실패 또는 high-risk finding을 Jira에 기록할지 팀 정책에 따라 결정

## n8n credentials

아래 값은 서버 `.env`보다 n8n Credential로 등록하는 것을 우선합니다.

| Credential | 권장 권한 | 용도 |
| --- | --- | --- |
| `gitlab-review-token` | read_api, api 또는 MR comment 가능 권한 | MR diff 조회 및 comment 작성 |
| `review-agent-token` | review API 호출 권한 | 자동 리뷰 agent 호출 |
| `jira-token` | issue/comment 권한 | Jira 기록 또는 이슈 생성 |

GitLab token은 최소 권한 원칙을 따릅니다. comment 작성까지 n8n이 수행하려면 단순 `read_repository`보다 더 넓은 API 권한이 필요할 수 있습니다.

## Secret token 검증

GitLab Webhook Secret token은 n8n workflow 초반에서 검증합니다.

검증 기준:

```text
X-Gitlab-Token header == expected secret
```

secret 값은 n8n Credential 또는 workflow variable로 관리하고 문서나 Git에 남기지 않습니다.

## 완료 기준

- n8n owner 계정 생성 완료
- n8n Webhook workflow 생성
- GitLab Merge request events Webhook 등록
- GitLab Webhook test 또는 실제 MR update로 workflow 실행 확인
- GitLab MR comment 작성 확인
- 실패 시 n8n execution log에서 원인 확인 가능

## 후속 개선

- 중복 리뷰 방지: commit SHA 또는 MR updated_at 기준으로 idempotency 처리
- 리뷰 범위 제한: lockfile, generated file, binary file 제외
- comment update 방식: 매번 새 댓글이 아니라 기존 bot 댓글 수정
- Jira 기록 조건 분리
- Review Agent timeout/retry 정책 추가
