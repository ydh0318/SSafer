# n8n Setup

`S14P31B105-160` 기준 EC2 #1 n8n 운영 설정 가이드입니다.

## 기준

- n8n container: `ssafer-n8n`
- Public path: `https://k14b105.p.ssafy.io/n8n/`
- Internal port: `5678`
- Database: PostgreSQL `n8n` database
- Reverse proxy: NGINX `/n8n/`

## 사용 목적

n8n은 SSAfer 제품 런타임의 필수 경로가 아니라 팀 내부 개발 품질 향상을 위한 DevOps automation 도구입니다.

현재 1차 목적은 MR 자동 리뷰 오케스트레이터입니다.

```text
GitLab MR event
→ n8n webhook
→ GitLab API로 MR metadata/diff 조회
→ review agent 또는 LLM API 호출
→ GitLab MR comment 작성
→ 필요 시 Jira 기록
```

Jenkins Webhook은 배포 자동화용이고, n8n Webhook은 MR 리뷰/알림 자동화용으로 분리합니다.

## 현재 n8n 인증 방식

n8n 1.x에서는 예전 basic auth/JWT 방식이 제거되었습니다. `N8N_BASIC_AUTH_ACTIVE`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`를 운영 인증 설정으로 사용하지 않습니다.

첫 접속 시 n8n UI에서 owner 계정을 생성하는 user management 흐름을 사용합니다.

## 필수 env

EC2 #1 운영 `.env`에 아래 값을 준비합니다.

```text
N8N_ENCRYPTION_KEY=REPLACE_WITH_N8N_KEY
N8N_DB_NAME=n8n
N8N_EDITOR_BASE_URL=https://k14b105.p.ssafy.io/n8n/
```

`N8N_ENCRYPTION_KEY`는 credentials 암호화에 사용되므로 최초 기동 후 변경하면 기존 credentials를 복호화할 수 없습니다.

생성 예시:

```bash
openssl rand -hex 32
```

## PostgreSQL DB 생성

PostgreSQL 공식 이미지는 `POSTGRES_DB` 하나만 자동 생성합니다. n8n은 별도 DB인 `n8n`을 사용하므로 init script로 DB를 생성합니다.

```text
Infra/docker/ec2-1/prod/initdb/01-create-n8n-db.sh
```

주의:

- init script는 PostgreSQL data volume이 처음 생성될 때만 실행됩니다.
- 이미 postgres volume이 만들어진 뒤라면 수동으로 DB를 생성해야 할 수 있습니다.

수동 생성 예시:

```bash
docker exec -it ssafer-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
CREATE DATABASE n8n;
```

이미 DB가 있으면 생성하지 않습니다.

## Reverse proxy env

n8n이 NGINX 뒤에서 동작하므로 public URL을 명시합니다.

```yaml
N8N_PROTOCOL: https
N8N_HOST: k14b105.p.ssafy.io
N8N_PATH: /n8n/
WEBHOOK_URL: https://k14b105.p.ssafy.io/n8n/
N8N_EDITOR_BASE_URL: ${N8N_EDITOR_BASE_URL:-https://k14b105.p.ssafy.io/n8n/}
N8N_PROXY_HOPS: 1
```

`WEBHOOK_URL`은 production webhook URL을 올바르게 표시하기 위해 필요합니다. `N8N_PROXY_HOPS=1`은 reverse proxy 뒤에서 forwarded header를 신뢰하기 위해 필요합니다.

## 기동

EC2 #1 prod compose 디렉터리에서 실행합니다.

```bash
cd /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod
sudo -u jenkins docker compose --env-file .env up -d postgres n8n
```

전체 배포에서는 Jenkins pipeline 또는 deploy script가 compose를 실행합니다.

## 확인

컨테이너 상태:

```bash
sudo -u jenkins docker compose --env-file .env ps n8n
sudo -u jenkins docker compose --env-file .env logs -f n8n
```

로컬 확인:

```bash
curl -I http://localhost:5678
```

NGINX 기동 후 외부 확인:

```bash
curl -I https://k14b105.p.ssafy.io/n8n/
```

첫 접속 시 owner 계정을 생성합니다.

## .env 권한 확인

운영 `.env`는 Jenkins가 읽는 secret 파일이므로 아래 권한을 권장합니다.

```bash
sudo chown jenkins:jenkins .env
sudo chmod 600 .env
```

이 상태에서는 `ubuntu` 사용자가 직접 `docker compose --env-file .env ...`를 실행하면 `.env: permission denied`가 발생할 수 있습니다. 수동 확인은 `sudo -u jenkins`로 실행합니다.

```bash
sudo -u jenkins docker compose --env-file .env config >/dev/null
sudo -u jenkins docker compose --env-file .env config | grep -n "N8N_EDITOR_BASE_URL\\|N8N_PROXY_HOPS"
```

## nginx 프록시 동작 원리

`N8N_PATH=/n8n/` 설정 시 n8n SPA는 `/n8n/rest/...` 경로로 API를 호출한다.
nginx는 `/n8n/` prefix를 제거하고 n8n 컨테이너의 `/rest/...`로 전달한다.
n8n REST API는 내부적으로 `/rest/` 경로에 있으므로 정상 동작한다.

```
브라우저: GET /n8n/rest/settings
nginx:    /n8n/ 매칭 → proxy_pass http://n8n:5678/ → GET /rest/settings ✓
```

문제 발생 시 nginx의 proxy_pass 경로를 변경하기 전에 반드시 n8n REST API 실제 경로를 먼저 확인한다.

```bash
docker exec ssafer-nginx wget -qO- http://n8n:5678/rest/settings 2>&1 | head -1
# JSON 응답이면 /rest/ 가 올바른 경로
```

## 주의사항

- n8n DB와 Spring DB는 같은 PostgreSQL instance 안에서 DB 이름만 분리합니다.
- `N8N_ENCRYPTION_KEY`는 반드시 백업합니다.
- GitLab/Jira/Review Agent token은 서버 `.env`보다 n8n Credential로 관리하는 것을 우선합니다.
- `/n8n/` subpath 운영은 reverse proxy 설정에 민감합니다. "Could not connect to server" 오류는 API 라우팅 문제이므로 브라우저 네트워크 탭에서 실패한 API 경로를 먼저 확인합니다.
- n8n image tag는 운영 안정성을 위해 추후 `latest` 대신 고정 버전으로 바꾸는 것을 권장합니다.
