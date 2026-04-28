# Environment Variable Inventory

`S14P31B105-160` 기준 운영 배포 환경변수 정리 문서입니다.

## 기준

운영 배포에서 실제 컨테이너가 읽는 환경변수의 source of truth는 Infra의 compose별 `.env` 파일입니다.

```text
EC2 #1: /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod/.env
EC2 #2: /home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod/.env
```

`.env.example`은 Git에 커밋하고, 실제 `.env`는 서버에만 두며 `chmod 600 .env`로 보호합니다.

## EC2 #1 운영 env

EC2 #1은 Spring, PostgreSQL, Redis, n8n, NGINX를 실행합니다.

| 변수 | 사용처 | 설명 |
| --- | --- | --- |
| `POSTGRES_DB` | postgres, spring | Spring 기본 DB 이름 |
| `POSTGRES_USER` | postgres, spring, n8n | PostgreSQL 사용자 |
| `POSTGRES_PASSWORD` | postgres, spring, n8n | PostgreSQL 비밀번호 |
| `REDIS_PASSWORD` | redis, spring | Spring Redis 비밀번호 |
| `JWT_SECRET` | spring | JWT 서명 키 |
| `JWT_ISSUER` | spring | JWT issuer |
| `JWT_ACCESS_TOKEN_EXPIRES_SECONDS` | spring | access token 만료 시간 |
| `AWS_ACCESS_KEY_ID` | spring | S3 접근 키 |
| `AWS_SECRET_ACCESS_KEY` | spring | S3 secret |
| `AWS_REGION` | spring | AWS region |
| `AWS_S3_BUCKET` | spring | scan artifact bucket |
| `EC2_2_PRIVATE_IP` | spring compose | FastAPI 분석 서버 private IP |
| `INTERNAL_TOKEN` | spring, fastapi | 서버 간 내부 호출 공유 secret |
| `N8N_ENCRYPTION_KEY` | n8n | n8n credentials 암호화 키 |
| `N8N_DB_NAME` | postgres init, n8n | n8n 전용 DB 이름 |
| `N8N_EDITOR_BASE_URL` | n8n | n8n editor public URL |
| `SPRING_IMAGE` | compose | Jenkins가 push한 Spring image |
| `NGINX_IMAGE` | compose | Jenkins가 push한 NGINX image |

`INTERNAL_TOKEN`은 EC2 #2의 값과 반드시 동일해야 합니다.

## EC2 #2 운영 env

EC2 #2는 FastAPI 분석 서버와 LLM cache Redis를 실행합니다.

| 변수 | 사용처 | 설명 |
| --- | --- | --- |
| `REDIS_LLM_PASSWORD` | redis-llm, fastapi | LLM cache Redis 비밀번호 |
| `OLLAMA_BASE_URL` | fastapi | 현재 AI 코드가 사용하는 Ollama endpoint |
| `OLLAMA_MODEL` | fastapi | Ollama model 이름 |
| `OLLAMA_TEMPERATURE` | fastapi | LLM temperature |
| `ANTHROPIC_API_KEY` | fastapi env | Claude 전환 시 사용할 API key |
| `HASDATA_API_KEY` | fastapi env | 참조 검색 API key |
| `AWS_ACCESS_KEY_ID` | fastapi env | S3 접근 키 |
| `AWS_SECRET_ACCESS_KEY` | fastapi env | S3 secret |
| `AWS_REGION` | fastapi env | AWS region |
| `AWS_S3_BUCKET` | fastapi env | EC2 #1과 동일 bucket |
| `EC2_1_PRIVATE_IP` | fastapi compose | Spring callback 대상 private IP |
| `INTERNAL_TOKEN` | spring, fastapi | 서버 간 내부 호출 공유 secret |
| `FASTAPI_IMAGE` | compose | Jenkins가 push한 FastAPI image |

현재 AI 코드(`AI/app/core/config.py`)는 `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TEMPERATURE`를 읽습니다. Infra 계획의 Claude API 사용은 코드가 전환된 뒤 `ANTHROPIC_API_KEY`를 실제 사용하도록 맞춰야 합니다.

## Frontend build env

Frontend는 Vite build time 환경변수를 사용합니다.

| 변수 | 사용처 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | nginx Dockerfile build arg | React 앱이 호출할 API base URL |

현재 `Infra/docker/dockerfiles/nginx/Dockerfile` 기본값은 아래와 같습니다.

```text
https://k14b105.p.ssafy.io/api/v1
```

운영 도메인이 바뀌면 NGINX image build 시 `--build-arg VITE_API_BASE_URL=...`로 덮어씁니다.

## CLI env

CLI는 운영 컨테이너 env가 아니라 사용자 로컬 실행 환경 또는 `~/.ssafer/config.yml`을 사용합니다.

| 변수 | 사용처 | 설명 |
| --- | --- | --- |
| `SSAFER_TOKEN` | CLI | 업로드 인증 token |

CLI endpoint는 기본값이 `http://localhost:8080`이며, 로그인/설정 흐름에서 `~/.ssafer/config.yml`에 저장할 수 있습니다. 운영 서버 배포 `.env`에 포함하지 않습니다.

## 통합 원칙

- 서버 런타임 secret은 각 EC2의 prod `.env`에만 둡니다.
- 같은 의미의 값은 같은 이름을 사용합니다. 예: `INTERNAL_TOKEN`, `AWS_REGION`, `AWS_S3_BUCKET`.
- EC2 간 공유 secret은 양쪽 `.env`에 같은 값으로 넣습니다.
- 실제 코드가 읽지 않는 env는 문서에 `전환 예정` 또는 `현재 미사용`으로 표시합니다.
- build time 값(`VITE_API_BASE_URL`)과 runtime 값(Spring/FastAPI env)을 섞지 않습니다.

## EC2 #1 최소 작성 순서

Jenkins 배포 검증을 계속하려면 EC2 #1 `.env`부터 준비합니다.

```bash
cd /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod
cp .env.example .env
chmod 600 .env
```

필수로 먼저 채울 값:

```text
POSTGRES_PASSWORD
REDIS_PASSWORD
JWT_SECRET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
EC2_2_PRIVATE_IP
INTERNAL_TOKEN
N8N_ENCRYPTION_KEY
N8N_EDITOR_BASE_URL
SPRING_IMAGE
NGINX_IMAGE
```

EC2 #2가 아직 없으면 `EC2_2_PRIVATE_IP`는 임시 private IP placeholder로 둘 수 있지만, Spring이 실제 분석 요청을 보내는 기능은 동작하지 않습니다.
