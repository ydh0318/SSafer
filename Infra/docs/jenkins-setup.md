# Jenkins Setup

`S14P31B105-157` 기준 Jenkins 설치 및 파이프라인 설정 가이드입니다.

## 설치 위치

Jenkins는 EC2 #1 서비스 서버에만 설치합니다. EC2 #2에는 Jenkins를 설치하지 않고, Jenkins가 SSH로 접속해 배포 스크립트를 실행합니다.

## 설치 환경

- OS: Ubuntu 24.04.3 LTS(noble)
- Java: OpenJDK 21
- Jenkins port: `9090`
- Jenkins 기본 포트: `8080`

## Java 21 설치

Jenkins 설치 전 Java runtime을 먼저 준비합니다.

```bash
sudo apt update
sudo apt install -y fontconfig openjdk-21-jre
java -version
```

`java -version`이 21 계열로 출력되어야 합니다.

## Jenkins apt repository 등록

기존에 잘못 등록된 Jenkins repository 또는 keyring이 있으면 먼저 제거합니다.

```bash
sudo rm -f /etc/apt/sources.list.d/jenkins.list
sudo rm -f /etc/apt/keyrings/jenkins-keyring.asc
sudo rm -f /usr/share/keyrings/jenkins-keyring.asc
sudo mkdir -p /etc/apt/keyrings
```

Jenkins stable repository의 2026 signing key를 등록합니다.

```bash
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key

echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update
```

`NO_PUBKEY 7198F4B714ABFC68` 오류가 나오면 예전 key가 남아있는 것이므로 위 cleanup부터 다시 진행합니다.

## Jenkins 설치

```bash
sudo apt install -y jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins
sudo systemctl status jenkins --no-pager
```

초기 관리자 비밀번호는 아래 명령으로 확인합니다.

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

## 권장 포트 및 Prefix

Spring Boot가 `8080`을 사용할 예정이므로 Jenkins는 `9090`으로 변경합니다.
또한 nginx를 통해 HTTPS로 서빙하기 위해 `--prefix=/jenkins`를 함께 설정합니다.

```bash
sudo mkdir -p /etc/systemd/system/jenkins.service.d
sudo tee /etc/systemd/system/jenkins.service.d/override.conf <<'EOF'
[Service]
Environment="JENKINS_PORT=9090"
Environment="JENKINS_OPTS=--prefix=/jenkins"
EOF
```

적용합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl restart jenkins
sudo systemctl status jenkins --no-pager
curl -I http://localhost:9090/jenkins/
# 403 Forbidden + Set-Cookie Path=/jenkins → 정상
```

> **주의**: `--prefix=/jenkins` 설정 후에는 GitLab Webhook URL도
> `/jenkins/` 경로가 포함된 URL로 업데이트해야 합니다. (`gitlab-webhook.md` 참고)

UFW는 내부 참고용으로만 열어둡니다. 외부 접근은 nginx 프록시를 통해서만 허용합니다.

```bash
sudo ufw allow 9090/tcp
```

## nginx 프록시 설정

HSTS 정책으로 인해 도메인에서 HTTP 포트(9090)로 직접 접근이 불가합니다.
nginx `/jenkins/` 경로를 통해 HTTPS(443)로 서빙합니다.

nginx.conf 443 서버 블록에 아래 location을 추가합니다.

```nginx
location /jenkins/ {
    proxy_pass         http://172.18.0.1:9090/jenkins/;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
    proxy_read_timeout 90s;
    proxy_connect_timeout 10s;
}
```

`172.18.0.1`은 nginx 컨테이너의 Docker bridge gateway IP입니다. 변경 시 아래로 확인합니다.

```bash
docker exec ssafer-nginx ip route | grep default
# default via 172.18.0.1 dev eth0
```

nginx 이미지 재빌드 후 Jenkins URL을 설정합니다.

Manage Jenkins → System → Jenkins URL:

```
https://<LEGACY_DEPLOY_DOMAIN>/jenkins/
```

## 필수 권한

Jenkins가 Docker image build/push를 수행하므로 `jenkins` 유저를 `docker` 그룹에 추가합니다.

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
sudo -u jenkins docker ps
```

## Jenkins Credentials

`Infra/Jenkinsfile`은 아래 credential ID를 사용합니다.

| ID | 유형 | 용도 |
| --- | --- | --- |
| `dockerhub-namespace` | Secret text | Docker Hub namespace 또는 organization |
| `dockerhub-credentials` | Username with password | Docker Hub login |
| `ec2-2-host` | Secret text | EC2 #2 public DNS 또는 SSH 접속 host |
| `ec2-2-ssh-key` | SSH Username with private key | Jenkins에서 EC2 #2로 SSH 접속 |

민감정보는 Jenkins Credentials에만 저장하고 Git repository에는 커밋하지 않습니다.

## Pipeline 설정

- Pipeline type: Pipeline script from SCM
- Repository URL: GitLab repository URL
- Branch: `develop`
- Script Path: `Infra/Jenkinsfile`

## 배포 전 서버 파일

EC2 #1에는 Jenkins가 쓸 배포 루트가 아래 경로로 준비되어 있어야 합니다. Jenkins 프로세스가 `/home/ubuntu` 하위 경로에 쓰기 권한을 갖지 못할 수 있으므로 Jenkins home 아래를 배포 루트로 사용합니다.

```text
/var/lib/jenkins/ssafer/S14P31B105
```

Jenkins가 EC2 #1 배포 파일을 동기화할 수 있도록 권한을 부여합니다.

```bash
sudo mkdir -p /var/lib/jenkins/ssafer/S14P31B105
sudo chown -R jenkins:jenkins /var/lib/jenkins/ssafer
sudo chmod -R u+rwX /var/lib/jenkins/ssafer
```

EC2 #2에는 repo가 아래 경로로 clone되어 있어야 합니다.

```text
/home/ubuntu/ssafer/S14P31B105
```

각 prod 디렉터리에는 실제 운영 `.env`가 있어야 합니다.

```text
/var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod/.env
/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod/.env
```

`.env` 파일은 Git에 커밋하지 않고 `chmod 600 .env`로 보호합니다.

## 검증

```bash
java -version
sudo systemctl status jenkins --no-pager
sudo ss -ltnp | grep ':9090'
curl -I http://localhost:9090/login
sudo -u jenkins docker ps
docker compose version
```

완료 기준:

- `https://<LEGACY_DEPLOY_DOMAIN>/jenkins/`에서 Jenkins 로그인 화면이 보임
- Jenkins service active
- `9090` 포트에 Jenkins Java 프로세스가 떠 있음 (`sudo ss -tlnp | grep 9090`)
- Jenkins 사용자가 Docker 명령 실행 가능
- Jenkins Pipeline job에서 `Infra/Jenkinsfile`을 읽을 수 있음

Pipeline 1회 수동 실행 후 다음을 확인합니다.

- Docker Hub에 `ssafer-spring`, `ssafer-fastapi`, `ssafer-nginx` 이미지 push
- EC2 #1 `deploy-ec2-1.sh` 실행 성공
- EC2 #2 SSH 접속 및 `deploy-ec2-2.sh` 실행 성공
