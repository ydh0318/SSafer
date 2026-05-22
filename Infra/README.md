# SSafer Infra

SSafer 운영 인프라의 구성·배포·초기 세팅을 관리하는 디렉터리입니다.
Docker Compose 기반 2-EC2 아키텍처, Jenkins CI/CD, Nginx 리버스 프록시, n8n MR 리뷰 자동화를 포함합니다.

---

## 목차

- [전체 아키텍처](#전체-아키텍처)
- [서버 구성](#서버-구성)
- [요청 흐름](#요청-흐름)
- [네트워크 / 포트 정책](#네트워크--포트-정책)
- [디렉터리 구조](#디렉터리-구조)
- [CI/CD 파이프라인](#cicd-파이프라인)
- [로컬(dev) 실행](#로컬dev-실행)
- [운영(prod) 배포](#운영prod-배포)
- [EC2 초기 세팅](#ec2-초기-세팅)
- [환경변수](#환경변수)
- [관련 문서](#관련-문서)

---

## 전체 아키텍처

SSafer는 **서비스 서버(EC2 #1)** 와 **AI 분석 서버(EC2 #2)** 로 분리된 2-EC2 구조입니다.
두 서버는 **서로 다른 AWS 계정/VPC** 에 있어 private IP로 통신할 수 없으며, **public IP + UFW 화이트리스트**로 통신을 보호합니다.

```text
                          ┌──────────────────────── 사용자 / CLI ────────────────────────┐
                          │                                                              │
                  https://ssafer.co.kr (제품)              https://k14b105.p.ssafy.io (운영 도구)
                          │                                                              │
        ┌─────────────────┼──────────────────────────────────────────────────────────┐ │
        │  EC2 #1 (서비스 서버)            ▼                                            │ │
        │                          ┌──────────────┐  443/80                            │ │
        │                          │    nginx     │◀───────────────────────────────────┘ │
        │                          └──────┬───────┘  /n8n /jenkins /rabbitmq (운영 도메인)  │
        │           ┌─────────────────────┼────────────────────┐                          │
        │           ▼                     ▼                     ▼                          │
        │   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐                  │
        │   │    spring    │─────▶│    engine    │      │     n8n      │                  │
        │   │   :8080      │ 스캔  │   :8100      │      │   :5678      │                  │
        │   └──┬───┬───┬───┘      └──────────────┘      └──────────────┘                  │
        │      │   │   │                                                                   │
        │  ┌───▼┐ ┌▼──┐ ┌▼────────┐                                                       │
        │  │ PG │ │RDS│ │RabbitMQ │  8989→5672                                            │
        │  └────┘ └───┘ └────┬────┘                                                       │
        └────────────────────┼──────────────────────────────────────────────────────────┘
                             │  ① 스캔 작업 발행          ▲ ③ 결과 콜백 (Spring :8080)
                             ▼                           │
        ┌────────────────────────────────────────────────┼─────────────────────────────┐
        │  EC2 #2 (AI 분석 서버)                           │                              │
        │   ┌──────────────┐  ② 소비    ┌──────────────┐  │   ┌──────────────┐           │
        │   │   worker     │───────────▶│   fastapi    │──┘   │    ollama    │           │
        │   │ (consumer)   │            │   :8000      │─────▶│   :11434     │           │
        │   └──────────────┘            └──────┬───────┘      └──────────────┘           │
        └──────────────────────────────────────┼──────────────────────────────────────┘
                                                ▼
                                        LLM (GMS / Anthropic / Ollama)
                                                +
                                        AWS S3 (raw / analysis)
```

**비동기 분석 파이프라인**

1. Spring이 스캔 raw 결과를 S3에 업로드하고 RabbitMQ에 분석 작업을 발행한다.
2. EC2 #2의 `worker`가 큐에서 작업을 소비해 FastAPI 분석을 호출하고, LLM으로 위험 설명·수정 제안·검증을 수행한다.
3. 분석 결과를 S3에 저장한 뒤 Spring 콜백으로 완료를 통지한다.

---

## 서버 구성

### EC2 #1 — 서비스 서버 (`ssafer.co.kr`)

| 컨테이너 | 이미지 | 포트(호스트) | 역할 |
| --- | --- | --- | --- |
| `ssafer-nginx` | 자체 빌드 (Frontend 정적 + 프록시) | `80`, `443` | TLS 종단, 리버스 프록시, SPA 서빙 |
| `ssafer-spring` | 자체 빌드 | `8080` | 메인 API 서버 (Spring Boot) |
| `ssafer-engine` | 자체 빌드 (CLI + Trivy) | 내부 `8100` | 업로드 파일 보안 스캔 엔진 |
| `ssafer-postgres` | `postgres:16-alpine` | `127.0.0.1:5432` | 메인 DB (+ n8n DB) |
| `ssafer-redis` | `redis:7.4-alpine` | `127.0.0.1:6379` | 세션/캐시/인증 코드 |
| `ssafer-rabbitmq` | `rabbitmq:3.13-management` | `8989→5672`, `127.0.0.1:15672` | 메시지 브로커 |
| `ssafer-n8n` | `n8nio/n8n:latest` | `127.0.0.1:5678` | MR 리뷰 자동화 |
| Jenkins | 호스트 systemd (컨테이너 아님) | `9090` (`--prefix=/jenkins`) | CI/CD |

> Jenkins는 컨테이너가 아니라 **호스트 systemd 서비스**로 EC2 #1에 설치되어 같은 서버에서 직접 배포한다.
> nginx는 Docker bridge gateway IP(`172.18.0.1:9090`)로 호스트 Jenkins에 프록시한다.

### EC2 #2 — AI 분석 서버

| 컨테이너 | 이미지 | 포트(호스트) | 역할 |
| --- | --- | --- | --- |
| `ssafer-fastapi` | 자체 빌드 | `8000` | 분석 API (LangChain) |
| `ssafer-ai-worker` | 동일 이미지, consumer 모드 | 없음 | RabbitMQ 소비 → 분석 실행 |
| `ssafer-ollama` | `ollama/ollama:latest` | 내부 `11434` | 로컬 LLM 런타임 (CPU) |

> `fastapi`와 `worker`는 **같은 이미지**를 사용하며 실행 커맨드만 다르다(`worker`는 `python -m app.worker.async_consumer`).
> LLM 제공자는 `LLM_PROVIDER`로 전환한다: `gms`(기본, OpenAI 호환 게이트웨이) / `anthropic` / `ollama`.

---

## 요청 흐름

| 경로 | 대상 | 비고 |
| --- | --- | --- |
| `https://ssafer.co.kr/` | nginx → SPA(`/usr/share/nginx/html`) | React 정적 파일 |
| `https://ssafer.co.kr/api/` | nginx → `spring:8080` | 메인 API |
| `https://ssafer.co.kr/ws/` | nginx → `spring:8080` (WebSocket) | Agent 연결 (read timeout 24h) |
| `.../api/v*/scans/{id}/status` | nginx → `spring:8080` | 진행 상황 스트리밍 (buffering off) |
| `.../api/v*/internal/agents/` | nginx → `spring:8080` | Agent 토큰 발급 등 허용된 internal |
| `.../api/v*/internal/` (그 외) | **403 deny** | 내부 전용 경로 외부 차단 |
| `EC2#1 spring` → `EC2#2 fastapi:8000` | public IP, UFW 화이트리스트 | 동기 분석 호출 |
| `EC2#2 worker` → `EC2#1 rabbitmq:8989` | public IP, UFW 화이트리스트 | 작업 소비 |
| `EC2#2 worker` → `EC2#1 spring:8080` | public IP, UFW 화이트리스트 | 결과 콜백 |

운영 도구는 제품 도메인에서 차단하고 SSAFY 도메인에서만 노출한다.

| 운영 도메인 경로 (`k14b105.p.ssafy.io`) | 대상 |
| --- | --- |
| `/n8n/` | `n8n:5678` |
| `/jenkins/` | 호스트 Jenkins (`172.18.0.1:9090`) |
| `/rabbitmq/` | `rabbitmq:15672` (관리 UI) |

> 제품 도메인(`ssafer.co.kr`)에서 `/n8n`, `/jenkins`, `/rabbitmq`, `/rest`, `/webhook` 등은 모두 **404**로 막혀 있다.

---

## 네트워크 / 포트 정책

EC2 #1/#2는 다른 VPC이므로 **public IP로 통신**하며, 해당 포트는 호스트 전체에 바인딩되지만 **UFW에서 상대 서버 IP만 허용**한다.

### EC2 #1 UFW

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 9090/tcp                                  # Jenkins (AWS SG도 확인)
sudo ufw allow from <EC2_2_PUBLIC_IP> to any port 8080 proto tcp   # FastAPI worker 콜백
sudo ufw allow from <EC2_2_PUBLIC_IP> to any port 8989 proto tcp   # RabbitMQ
sudo ufw enable
```

### EC2 #2 UFW

```bash
sudo ufw allow 22/tcp
sudo ufw allow from <EC2_1_PUBLIC_IP> to any port 8000 proto tcp   # Spring → FastAPI
sudo ufw enable
```

DB(5432)·Redis(6379)·RabbitMQ 관리(15672)·n8n(5678)은 `127.0.0.1`에만 바인딩되어 호스트 외부에 노출되지 않는다.

---

## 디렉터리 구조

```text
Infra/
├── Jenkinsfile                     # CI/CD 파이프라인 정의
├── docker/
│   ├── dockerfiles/
│   │   ├── Dockerfile.spring       # Spring Boot (multi-stage, temurin 21)
│   │   ├── Dockerfile.fastapi      # AI FastAPI/worker (python 3.11)
│   │   ├── Dockerfile.engine       # 스캔 엔진 (CLI + Trivy 0.67)
│   │   └── nginx/
│   │       ├── Dockerfile          # Frontend 빌드 + nginx 런타임
│   │       └── nginx.conf          # 리버스 프록시 / TLS / 라우팅
│   ├── ec2-1/{dev,prod}/           # 서비스 서버 compose + .env.example
│   │   ├── docker-compose.yml
│   │   ├── initdb/                 # n8n DB 생성 스크립트 (prod)
│   │   └── rabbitmq/               # rabbitmq.conf, definitions.json
│   └── ec2-2/{dev,prod}/           # 분석 서버 compose + .env.example
├── scripts/
│   ├── deploy-ec2-1.sh             # EC2 #1 배포 (Jenkins 호출)
│   └── deploy-ec2-2.sh             # EC2 #2 배포 (Jenkins SSH 호출)
├── n8n/workflows/                  # MR 리뷰 워크플로 템플릿
└── docs/                           # 세부 운영 가이드
```

> **빌드 컨텍스트는 항상 레포 루트**다. 모든 Dockerfile이 `Backend/`, `AI/`, `CLI/`, `Engine/`, `Frontend/` 경로를 참조하므로 `docker build -f Infra/docker/dockerfiles/... .` 형태로 루트에서 빌드한다.

---

## CI/CD 파이프라인

`Jenkinsfile` 기준 흐름:

```text
GitLab push (webhook)
  → Checkout (변경 경로 감지)
  → Build Images (spring / fastapi / engine / nginx)
  → Push Images (Docker Hub, 태그 = BUILD_NUMBER)
  → Sync & Deploy EC2 #1   (deploy-ec2-1.sh)
  → Sync & Deploy EC2 #2   (조건부, deploy-ec2-2.sh via SSH)
  → Mattermost 알림 (성공/실패)
```

**변경 경로 기반 조건부 배포**

- `AI/`, `Infra/docker/ec2-2/`, `Dockerfile.fastapi`, `deploy-ec2-2.sh` 변경 시 → EC2 #2 자동 배포
- `CLI/`, `Engine/`, `Dockerfile.engine` 변경 시 → engine 이미지 재빌드
- 수동으로는 `DEPLOY_EC2_2=true` 파라미터로 강제 가능

**이미지 태그**: Jenkins `BUILD_NUMBER`. `.env`의 `*_IMAGE` 값은 fallback이며, 배포 시 실제 빌드 태그가 환경변수로 override된다.

**Frontend 빌드 인자**: nginx 이미지 빌드 시 `.env`에서 `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GITHUB_CLIENT_ID`를 읽어 build-arg로 주입한다.

필요한 Jenkins Credentials: `dockerhub-namespace`, `dockerhub-credentials`, `gitlab-credentials`, `ec2-2-host`, `ec2-2-ssh-key`, `mattermost-webhook-url`.

---

## 로컬(dev) 실행

```bash
# 1회: ec2-1/ec2-2 dev compose가 공유하는 브리지 네트워크 생성
docker network create ssafer-dev

# EC2 #2 먼저 기동
cd Infra/docker/ec2-2/dev
cp .env.example .env          # 값 채우기
docker compose --env-file .env up -d

# EC2 #1 기동
cd ../../ec2-1/dev
cp .env.example .env          # 값 채우기
docker compose --env-file .env up -d
```

---

## 운영(prod) 배포

운영 배포는 Jenkins가 자동 수행한다. 수동 검증/재배포 시:

```bash
# EC2 #1 (Jenkins 사용자로 실행 — .env가 jenkins:jenkins 600 권한)
cd /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod
sudo -u jenkins docker compose --env-file .env config >/dev/null
bash /var/lib/jenkins/ssafer/S14P31B105/Infra/scripts/deploy-ec2-1.sh

# EC2 #2
cd /home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod
FASTAPI_IMAGE=<namespace>/ssafer-fastapi:<tag> \
  bash /home/ubuntu/ssafer/S14P31B105/Infra/scripts/deploy-ec2-2.sh
```

배포 스크립트는 필수 환경변수 존재/플레이스홀더 여부를 검증한 뒤 `pull → up -d → 헬스체크` 순으로 진행한다.
EC2 #1은 Spring Boot(`/actuator/health`)를 최대 120초, EC2 #2는 FastAPI(`/health`)를 최대 60초 대기한다.

---

## EC2 초기 세팅

신규 인스턴스에 공통 적용하는 절차입니다. (UFW 정책은 위 [네트워크 / 포트 정책](#네트워크--포트-정책) 참고)

### 1. SSH 접속 안정화

UFW로 SSH가 끊길 상황에 대비해 터미널을 2개 이상 열어둔다.

```bash
whoami; hostname; lsb_release -a; uname -a
sudo ufw status numbered
```

### 2. 기본 패키지

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release unzip git
```

### 3. Docker 설치

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
```

### 4. Docker 권한

```bash
sudo usermod -aG docker ubuntu
exit            # 재접속 후
groups; docker ps; docker compose version
```

### 5. AWS CLI v2

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install && aws --version
rm -rf aws awscliv2.zip
```

### 6. 배포 디렉터리 / `.env`

```bash
# EC2 #1 — Jenkins가 같은 서버에서 배포하므로 Jenkins home 사용
sudo mkdir -p /var/lib/jenkins/ssafer/S14P31B105
sudo chown -R jenkins:jenkins /var/lib/jenkins/ssafer

# EC2 #2
mkdir -p /home/ubuntu/ssafer/S14P31B105
```

운영 `.env`는 각 `prod` 디렉터리에 생성하며 **절대 Git에 커밋하지 않는다**.

```bash
cp .env.example .env && chmod 600 .env
```

### 7. 최종 검증

```bash
docker run --rm hello-world      # 정상 출력
docker ps                        # sudo 없이 실행
docker compose version
aws --version
sudo ufw status numbered         # SSH 22번 유지 확인
```

> Jenkins/SSL/도메인 등 EC2 #1 전용 세팅과 코드↔인프라 불일치 주의사항은 [docs/](#관련-문서) 및 `exec/` 디렉터리의 가이드를 참고한다.

---

## 환경변수

`.env`는 각 `docker/ec2-*/prod/.env.example`을 복사해 작성한다. 주요 항목:

| 항목 | 위치 | 발급/확인 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | EC2 #1 | 강력한 비밀번호 |
| `RABBITMQ_USERNAME` / `RABBITMQ_PASSWORD` | EC2 #1/#2 | 양쪽 동일 |
| `JWT_SECRET` | EC2 #1 | `openssl rand -hex 32` |
| `INTERNAL_TOKEN` / `SPRING_API_SECRET` | EC2 #1/#2 | 서버 간 공유 시크릿 |
| `EC2_2_PUBLIC_IP` (EC2 #1용) / public IP | 양쪽 | AWS 콘솔 → EC2 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | 양쪽 | S3 접근 |
| `APP_SCAN_RAW_S3_BUCKET` / `APP_ANALYSIS_RESULT_S3_BUCKET` | 양쪽 | S3 버킷 |
| `LLM_PROVIDER` / `GMS_API_KEY` / `ANTHROPIC_API_KEY` | EC2 #2 | LLM 게이트웨이/콘솔 |
| `HASDATA_API_KEY` | EC2 #2 | HasData 콘솔 |
| `RESEND_API_KEY` | EC2 #1 | 이메일 인증 (Resend) |
| `VITE_GOOGLE_CLIENT_ID` / `VITE_GITHUB_CLIENT_ID` | EC2 #1 | OAuth (프론트 빌드 시 주입) |
| `N8N_ENCRYPTION_KEY` | EC2 #1 | n8n 자격증명 암호화 |
| `*_IMAGE` | 양쪽 | Docker Hub 태그 (Jenkins override) |

> 전체 환경변수 명세는 [docs/env-inventory.md](./docs/env-inventory.md) 참고.

> **타임존(TZ) 설정 주의사항**:
> - **n8n**: 워크플로 및 크론 작업 시 현지 시간 표시를 위해 KST(`Asia/Seoul`) 타임존을 사용합니다.
> - **Spring Boot (`ssafer-spring`)**: DB(PostgreSQL) 및 AI 서버(FastAPI)와의 시간 정합성 유지를 위해, `.env` 설정을 무시하고 `docker-compose.yml` 내에서 **UTC**(`TZ: UTC`, `user.timezone=UTC`)로 강제 구동합니다.

---

## 관련 문서

| 문서 | 내용 |
| --- | --- |
| [exec/1.build_and_deploy.md](../exec/1.build_and_deploy.md) | 빌드 및 배포 가이드 (Jenkins, Docker Compose) |
| [exec/2.external_service.md](../exec/2.external_service.md) | 외부 서비스 설정 가이드 (Let's Encrypt, Resend, OAuth) |
| [docs/env-inventory.md](./docs/env-inventory.md) | 환경변수 전체 인벤토리 |
| [docs/jenkins-setup.md](./docs/jenkins-setup.md) | Jenkins 설치/포트/프록시 |
| [docs/gitlab-webhook.md](./docs/gitlab-webhook.md) | GitLab Webhook 연동 |
| [docs/certbot-ssl.md](./docs/certbot-ssl.md) | Let's Encrypt SSL 발급 |
| [docs/certbot-renewal-validation.md](./docs/certbot-renewal-validation.md) | 인증서 갱신 검증 |
| [docs/official-domain-https-oauth.md](./docs/official-domain-https-oauth.md) | 공식 도메인·HTTPS·OAuth 정합 |
| [docs/s3-presigned-upload-cors.md](./docs/s3-presigned-upload-cors.md) | S3 presigned 업로드 CORS |
| [docs/n8n-setup.md](./docs/n8n-setup.md) | n8n 설치/프록시 |
| [docs/n8n-mr-review-orchestrator.md](./docs/n8n-mr-review-orchestrator.md) | MR 리뷰 오케스트레이터 |
| [docs/n8n-mr-review-final.md](./docs/n8n-mr-review-final.md) | MR 리뷰 최종 워크플로 |
| [docs/n8n-workflow-export.md](./docs/n8n-workflow-export.md) | 워크플로 내보내기 / 시크릿 분리 |
| [docs/e2e-validation.md](./docs/e2e-validation.md) | End-to-End 검증 |
