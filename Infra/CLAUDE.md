# Infra CLAUDE.md

코드를 보는 것만으로는 알 수 없는 운영/배포 관련 정보.

---

## 코드와 Infra 설계 간 불일치 (반드시 확인)

### AI 서버: Ollama vs Claude API
`AI/requirements.txt`와 `AI/app/core/config.py`는 **Ollama 기반**으로 구현되어 있음.
```python
# 현재 코드
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
```
Infra는 **Claude Opus 4.7 API** 기준으로 설계됨 (`ANTHROPIC_API_KEY` 환경변수).
EC2 #2 컨테이너가 실제로 동작하려면 AI 팀에서 `anthropic` 패키지 및 코드 전환이 선행되어야 함.

### FastAPI 내부 콜백 경로 미구현
Infra 설계에서 FastAPI → Spring 콜백 경로는 `POST /api/v1/internal/callback`으로 가정.
현재 Spring에 존재하는 internal 경로는 `GET /api/v1/internal/scans/{scanId}/raw-results` (`ScanRawResultController`).
**`/api/v1/internal/callback`은 아직 Spring에 없음** — Backend 팀 구현 필요.

### Spring Boot Actuator 보안
`SecurityConfig`는 `/api/v1/guests/enter`만 명시적으로 permit하고 나머지는 인증 필요.
`/actuator/health`가 Spring Security에서 막힐 수 있음.
배포 전 `SecurityConfig`에서 Actuator 경로를 명시적으로 허용해야 healthcheck가 동작함:
```java
.requestMatchers("/actuator/health").permitAll()
```

### Spring 프로파일과 DB URL
`application-local.properties`에 `spring.datasource.url=jdbc:postgresql://localhost:5432/ssafer` 하드코딩.
dev compose에서 `SPRING_PROFILES_ACTIVE=local`로 설정하면 이 파일이 로드되지만,
compose의 `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/...` 환경변수가 우선 적용되므로 실제로는 문제없음.
Spring Boot 환경변수 우선순위: OS env > application.properties.

---

## dev 로컬 실행 전 수동 작업

```bash
# 1회: ec1/ec2 compose가 공유하는 브리지 네트워크 생성
docker network create ssafer-dev

# 실행 순서: ec2-2 먼저 기동 후 ec2-1 기동
cd Infra/docker/ec2-2/dev && cp .env.example .env  # 값 채운 후
docker compose --env-file .env up -d

cd Infra/docker/ec2-1/dev && cp .env.example .env  # 값 채운 후
docker compose --env-file .env up -d
```

---

## prod EC2 배포 전 수동 작업 (1회)

### 현재 EC2 #1 서버 상태

- OS: Ubuntu 24.04.3 LTS(noble)
- 역할: 서비스 서버 + Jenkins 서버
- Jenkins: systemd 서비스로 설치, `9090` 포트, `--prefix=/jenkins`
- Jenkins 접속 URL: `https://k14b105.p.ssafy.io/jenkins/` (nginx 프록시 경유)
- Docker/Compose: Jenkins 사용자가 Docker 명령을 실행하도록 설정
- Certbot: standalone 방식으로 `k14b105.p.ssafy.io` 인증서 발급 완료
- 운영 배포 루트: `/var/lib/jenkins/ssafer/S14P31B105`
- EC2 #2: 아직 미구성. Jenkinsfile에서 `DEPLOY_EC2_2=false` 기본값으로 스킵 가능

### Jenkins 설치/포트/프록시

Jenkins는 EC2 #1에만 설치했다. EC2 #2에는 Jenkins를 설치하지 않는다.

Jenkins 기본 포트는 `8080`이지만 Spring 운영 포트와 충돌하므로 systemd override로 `9090`을 사용한다.
nginx 배포 후 HSTS 정책으로 도메인에서 HTTP 포트 직접 접근이 불가하므로 `--prefix=/jenkins`를 추가하고 nginx로 프록시한다.

```bash
sudo cat /etc/systemd/system/jenkins.service.d/override.conf
```

기대 내용:

```ini
[Service]
Environment="JENKINS_PORT=9090"
Environment="JENKINS_OPTS=--prefix=/jenkins"
```

적용/확인:

```bash
sudo systemctl daemon-reload
sudo systemctl restart jenkins
sudo systemctl status jenkins --no-pager
curl -I http://localhost:9090/jenkins/
# 403 Forbidden + Set-Cookie Path=/jenkins → 정상
```

외부 접속은 nginx 프록시를 통해 `https://k14b105.p.ssafy.io/jenkins/` 로 접속한다.
nginx 컨테이너에서 호스트 Jenkins로의 연결은 Docker bridge gateway IP(`172.18.0.1`)를 사용한다.

```bash
# gateway IP 확인 (변경됐을 경우)
docker exec ssafer-nginx ip route | grep default
```

### UFW 방화벽 (EC2 #1)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 9090/tcp
sudo ufw allow from <EC2_2_PRIVATE_IP> to any port 8080 proto tcp
sudo ufw enable
```

현재 EC2 #1에서 UFW 9090은 열려 있음. 외부 Jenkins 접속이 안 될 경우 AWS Security Group inbound `TCP 9090`을 확인한다.

### UFW 방화벽 (EC2 #2)
```bash
sudo ufw allow 22/tcp
sudo ufw allow from <EC2_1_PRIVATE_IP> to any port 8000 proto tcp
sudo ufw enable
```

### SSL 인증서 발급 (EC2 #1)
```bash
sudo certbot certonly --standalone -d k14b105.p.ssafy.io
# 발급 후 /etc/letsencrypt/live/k14b105.p.ssafy.io/ 에 인증서 생성됨
# nginx 컨테이너가 이 경로를 볼륨으로 마운트함 (docker-compose.yml 참고)
```

초기 발급은 NGINX가 떠 있지 않은 상태라 `standalone` 방식으로 성공했다. 운영 갱신은 NGINX가 80에서 ACME challenge 경로를 제공한 뒤 `certbot renew --dry-run`으로 확인해야 한다.

### Jenkins apt repository 주의

Ubuntu 24.04에서는 Jenkins old key로 `NO_PUBKEY 7198F4B714ABFC68` 오류가 날 수 있다. `jenkins.io-2026.key` 기준으로 등록해야 한다.

```bash
sudo rm -f /etc/apt/sources.list.d/jenkins.list
sudo rm -f /etc/apt/keyrings/jenkins-keyring.asc
sudo mkdir -p /etc/apt/keyrings
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
```

Java는 21 기준:

```bash
sudo apt install -y fontconfig openjdk-21-jre
```

### 배포 디렉토리 구성

EC2 #1은 Jenkins가 같은 서버에서 직접 배포하므로 `/home/ubuntu`가 아니라 Jenkins home 아래를 배포 루트로 사용한다.

```bash
# EC2 #1
sudo mkdir -p /var/lib/jenkins/ssafer/S14P31B105
sudo chown -R jenkins:jenkins /var/lib/jenkins/ssafer
sudo chmod -R u+rwX /var/lib/jenkins/ssafer

# EC2 #2
mkdir -p /home/ubuntu/ssafer/S14P31B105
```

EC2 #1 운영 compose 위치:

```text
/var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod
```

EC2 #1 실제 `.env`는 Jenkins가 읽는 secret 파일이므로 아래 권한을 유지한다.

```bash
sudo chown jenkins:jenkins /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod/.env
sudo chmod 600 /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod/.env
```

`ubuntu` 사용자로 `docker compose --env-file .env ...`를 실행하면 `.env: permission denied`가 날 수 있다. 수동 검증은 Jenkins 사용자로 실행한다.

```bash
cd /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod
sudo -u jenkins docker compose --env-file .env config >/dev/null
```

---

## Dockerfile 빌드 컨텍스트

세 Dockerfile 모두 **레포 루트**를 build context로 사용해야 함.
```bash
# 레포 루트에서 실행
docker build -f Infra/docker/dockerfiles/Dockerfile.spring -t ssafer-spring:test .
docker build -f Infra/docker/dockerfiles/Dockerfile.fastapi -t ssafer-fastapi:test .
docker build -f Infra/docker/dockerfiles/nginx/Dockerfile -t ssafer-nginx:test .
```
Jenkins 파이프라인에서도 checkout 루트를 build context로 지정해야 함.

---

## .env 파일에 반드시 채워야 하는 값

| 항목 | 어디서 확인 |
|------|------------|
| `EC2_1_PRIVATE_IP` / `EC2_2_PRIVATE_IP` | AWS 콘솔 → EC2 → Private IPv4 주소 |
| `SPRING_IMAGE` / `FASTAPI_IMAGE` / `NGINX_IMAGE` | Docker Hub org 이름 확정 후 |
| `ANTHROPIC_API_KEY` | Anthropic 콘솔 |
| `HASDATA_API_KEY` | HasData 콘솔 |
| `INTERNAL_TOKEN` | `openssl rand -hex 32` (EC1, EC2 동일 값) |
| `JWT_SECRET` | `openssl rand -hex 32` |

---

## Jenkins Pipeline / Webhook 성공한 설정

### Jenkins Credentials

Jenkins에 아래 credential 등록 완료:

| ID | 용도 |
|----|------|
| `dockerhub-namespace` | Docker Hub namespace |
| `dockerhub-credentials` | Docker Hub username/access token |
| `gitlab-credentials` | GitLab repo checkout용 PAT |

EC2 #2는 아직 미구성이라 아래 credential은 나중에 등록:

| ID | 용도 |
|----|------|
| `ec2-2-host` | EC2 #2 host |
| `ec2-2-ssh-key` | EC2 #2 SSH key |

### Jenkins Job

- Job name: `ssafer-prod-deploy`
- Script Path: `Infra/Jenkinsfile`
- 검증 중에는 Branch Specifier를 `*/feature/S14P31B105-163-prod-deploy-validation`로 사용
- 운영 merge 후에는 `*/develop`으로 되돌릴 것

GitLab Webhook test push event로 Jenkins Job 자동 실행 확인 완료.

Jenkinsfile은 EC2 #2가 준비되지 않은 상태에서도 배포 검증할 수 있도록 `DEPLOY_EC2_2=false` 기본값을 사용한다.

### Docker build 이슈 해결

`Backend/ssafer/mvnw`가 Git에서 executable bit 없이 `100644`로 잡혀 있어 Docker build 중 `Permission denied`가 발생했다.

해결: `Dockerfile.spring`에서 `RUN chmod +x ./mvnw` 추가.

---

## EC2 #1 배포 성공/부분 성공 상태

EC2 #1에서 Jenkins 배포 후 아래 컨테이너 기동 확인:

```text
ssafer-nginx    80/443 published
ssafer-spring   8080 published, healthy
ssafer-n8n      127.0.0.1:5678 published
ssafer-postgres 127.0.0.1:5432 published, healthy
ssafer-redis    127.0.0.1:6379 published, healthy
```

Spring/Nginx image tag는 Jenkins build number를 사용한다. `.env`에는 `latest` 같은 fallback 값을 둘 수 있지만 Jenkins 배포 시 환경변수로 실제 build tag가 override된다.

```text
SPRING_IMAGE=<dockerhub-namespace>/ssafer-spring:latest
NGINX_IMAGE=<dockerhub-namespace>/ssafer-nginx:latest
```

---

## n8n 현재 상태

n8n 컨테이너 정상 동작, subpath proxy 정상.

- n8n container: alive
- 외부 접속: `https://k14b105.p.ssafy.io/n8n/` ✓
- owner setup 페이지 정상 접근 확인

nginx proxy 동작: `/n8n/` prefix 스트립 후 `http://n8n:5678/`로 전달.
n8n REST API는 `/rest/` 경로이며, SPA가 `/n8n/rest/...`로 호출하면 nginx가 스트립하여 정상 동달.

n8n은 팀 내부 MR 자동 리뷰 오케스트레이터 용도:

```text
GitLab MR event
→ n8n webhook
→ GitLab API로 MR metadata/diff 조회
→ review agent 또는 LLM API 호출
→ GitLab MR comment 작성
→ 필요 시 Jira 기록
```

Slack은 사용하지 않는 방향.

Jenkins Webhook은 배포용, n8n Webhook은 MR 리뷰 자동화용으로 분리한다.

---

## Spring Data Redis 미사용 상태

`pom.xml`에 `spring-boot-starter-data-redis` 의존성이 있으나 현재 구현 코드 없음.
Redis 연결 설정이 없으면 Spring Boot 시작 시 Redis 연결을 시도하다 실패할 수 있음.
compose 환경변수(`SPRING_DATA_REDIS_HOST` 등)가 있으므로 실제 Redis가 헬스체크를 통과한 뒤에 Spring이 기동됨 — 현재 설정으로 문제없음.
