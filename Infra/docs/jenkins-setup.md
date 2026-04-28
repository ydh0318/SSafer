# Jenkins Setup

`S14P31B105-157` 기준 Jenkins 설치 및 파이프라인 설정 가이드입니다.

## 설치 위치

Jenkins는 EC2 #1 서비스 서버에만 설치합니다. EC2 #2에는 Jenkins를 설치하지 않고, Jenkins가 SSH로 접속해 배포 스크립트를 실행합니다.

## 권장 포트

Spring Boot가 `8080`을 사용하므로 Jenkins는 `9090`으로 변경합니다.

```bash
sudo systemctl edit jenkins
```

```ini
[Service]
Environment="JENKINS_PORT=9090"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart jenkins
sudo systemctl status jenkins --no-pager
```

## 필수 권한

Jenkins가 Docker image build/push를 수행하므로 `jenkins` 유저를 `docker` 그룹에 추가합니다.

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

## Jenkins Credentials

`Infra/Jenkinsfile`은 아래 credential ID를 사용합니다.

| ID | 유형 | 용도 |
| --- | --- | --- |
| `dockerhub-namespace` | Secret text | Docker Hub namespace 또는 organization |
| `dockerhub-credentials` | Username with password | Docker Hub login |
| `ec2-2-host` | Secret text | EC2 #2 public DNS 또는 SSH 접속 host |
| `ec2-2-ssh-key` | SSH Username with private key | Jenkins에서 EC2 #2로 SSH 접속 |

## Pipeline 설정

- Pipeline type: Pipeline script from SCM
- Repository URL: GitLab repository URL
- Branch: `develop`
- Script Path: `Infra/Jenkinsfile`

## 배포 전 서버 파일

EC2 #1에는 Jenkins가 쓸 배포 루트가 아래 경로로 준비되어 있어야 합니다.

```text
/home/ubuntu/ssafer/S14P31B105
```

Jenkins가 EC2 #1 배포 파일을 동기화할 수 있도록 권한을 부여합니다.

```bash
sudo mkdir -p /home/ubuntu/ssafer/S14P31B105
sudo chown -R jenkins:jenkins /home/ubuntu/ssafer/S14P31B105
```

EC2 #2에는 repo가 아래 경로로 clone되어 있어야 합니다.

```text
/home/ubuntu/ssafer/S14P31B105
```

각 prod 디렉터리에는 실제 운영 `.env`가 있어야 합니다.

```text
/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-1/prod/.env
/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod/.env
```

`.env` 파일은 Git에 커밋하지 않고 `chmod 600 .env`로 보호합니다.

## 검증

```bash
sudo -u jenkins docker ps
docker compose version
curl -I http://localhost:9090
```

Pipeline 1회 수동 실행 후 다음을 확인합니다.

- Docker Hub에 `ssafer-spring`, `ssafer-fastapi`, `ssafer-nginx` 이미지 push
- EC2 #1 `deploy-ec2-1.sh` 실행 성공
- EC2 #2 SSH 접속 및 `deploy-ec2-2.sh` 실행 성공
