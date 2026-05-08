# SSAfer Infra

SSAfer 운영 인프라 구성과 EC2 초기 세팅 절차를 관리하는 디렉터리입니다.

## Related Docs

- S3 presigned upload CORS 가이드:
  [docs/s3-presigned-upload-cors.md](</c:/Users/SSAFY/Desktop/S14P31B105/Infra/docs/s3-presigned-upload-cors.md:1>)

## EC2 Initial Setup

이 절차는 `S14P31B105-159` 작업 기준입니다. EC2 #1 서비스 서버와 EC2 #2 분석 서버 모두에 공통으로 적용하되, UFW 포트 정책은 서버 역할에 맞게 다르게 적용합니다.

### 1. SSH 접속 안정화

UFW 설정 중 SSH가 끊기는 상황을 대비해 SSH 터미널을 2개 이상 열어둡니다.

```bash
whoami
hostname
lsb_release -a
uname -a
sudo ufw status numbered
```

### 2. 기본 패키지 설치

```bash
sudo apt update
sudo apt upgrade -y
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
sudo systemctl status docker --no-pager
```

### 4. Docker 권한 설정

```bash
sudo usermod -aG docker ubuntu
exit
```

SSH 재접속 후 확인합니다.

```bash
groups
docker ps
docker --version
docker compose version
```

### 5. AWS CLI v2 설치

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
  -o "awscliv2.zip"

unzip awscliv2.zip
sudo ./aws/install
aws --version

rm -rf aws awscliv2.zip
```

### 6. 배포 디렉터리 생성

컨테이너 이미지는 Docker Hub에서 pull하지만, 운영 서버에는 `docker-compose.yml`, `.env`, 배포 스크립트가 위치할 디렉터리가 필요합니다. 서버에는 repo clone 기준 경로를 사용합니다.

```bash
mkdir -p /home/ubuntu/ssafer
cd /home/ubuntu/ssafer
```

repo clone 후 주요 경로는 아래와 같습니다.

```text
/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-1/prod
/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod
/home/ubuntu/ssafer/S14P31B105/Infra/scripts
```

운영 `.env` 파일은 각 prod 디렉터리에 생성하고 Git에 커밋하지 않습니다.

```bash
cp .env.example .env
chmod 600 .env
```

### 7. UFW 정책

#### EC2 #1 서비스 서버

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8989/tcp
sudo ufw allow from <EC2_2_PRIVATE_IP> to any port 8080 proto tcp
sudo ufw enable
sudo ufw status numbered
```

#### EC2 #2 분석 서버

```bash
sudo ufw allow 22/tcp
sudo ufw allow from <EC2_1_PRIVATE_IP> to any port 8000 proto tcp
sudo ufw enable
sudo ufw status numbered
```

### 8. 최종 검증

```bash
docker run --rm hello-world
docker --version
docker compose version
aws --version
git --version
sudo ufw status numbered
```

완료 기준:

- `docker run --rm hello-world` 정상 출력
- `docker ps`가 `sudo` 없이 실행됨
- `docker compose version` 출력
- `aws --version` 출력
- UFW에서 SSH 22번 포트가 유지됨

## Jira Completion Comment

`S14P31B105-159` 완료 시 아래 내용을 Jira 코멘트로 남깁니다.

```markdown
EC2 초기 세팅 완료

- UFW 기본 포트 설정 확인
- Docker Engine 설치 완료
- Docker Compose plugin 설치 완료
- ubuntu 유저 docker 그룹 추가 완료
- AWS CLI v2 설치 완료
- 배포 디렉터리 구조 생성 완료
- docker hello-world 실행 확인

검증:
- docker --version
- docker compose version
- aws --version
- docker run --rm hello-world
- sudo ufw status numbered
```
