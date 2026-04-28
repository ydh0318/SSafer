# n8n Setup

`S14P31B105-160` 기준 EC2 #1 n8n 운영 설정 가이드입니다.

## 기준

- n8n container: `ssafer-n8n`
- Public path: `https://k14b105.p.ssafy.io/n8n/`
- Internal port: `5678`
- Database: PostgreSQL `n8n` database
- Reverse proxy: NGINX `/n8n/`

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
docker compose --env-file .env up -d postgres n8n
```

전체 배포에서는 Jenkins pipeline 또는 deploy script가 compose를 실행합니다.

## 확인

컨테이너 상태:

```bash
docker compose --env-file .env ps n8n
docker compose --env-file .env logs -f n8n
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

## 주의사항

- n8n DB와 Spring DB는 같은 PostgreSQL instance 안에서 DB 이름만 분리합니다.
- `N8N_ENCRYPTION_KEY`는 반드시 백업합니다.
- `/n8n/` subpath 운영은 reverse proxy 설정에 민감합니다. 화면 리소스나 webhook URL이 깨지면 `N8N_EDITOR_BASE_URL`, `WEBHOOK_URL`, `N8N_PROXY_HOPS`, NGINX `/n8n/` proxy header를 함께 확인합니다.
- n8n image tag는 운영 안정성을 위해 추후 `latest` 대신 고정 버전으로 바꾸는 것을 권장합니다.
