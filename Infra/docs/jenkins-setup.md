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

## 권장 포트

Spring Boot가 `8080`을 사용할 예정이므로 Jenkins는 `9090`으로 변경합니다.

현재 EC2 #1 서버에서는 `8988`, `8989`, `29418` 포트가 Gerrit 또는 기존 Java 서비스와 관련되어 있을 가능성이 높습니다. 특히 `8989`는 Jenkins 기본 포트가 아니며, 이미 다른 서비스와 충돌할 수 있으므로 Jenkins 포트로 사용하지 않습니다.

```bash
sudo systemctl edit jenkins
```

아래 내용을 입력합니다. `systemctl edit` 화면에서 `#`으로 시작하는 줄은 예시 주석이므로 그대로 두고, 주석이 아닌 새 줄에 추가하면 됩니다.

```ini
[Service]
Environment="JENKINS_PORT=9090"
```

저장이 어렵다면 drop-in 파일을 직접 생성해도 됩니다.

```bash
sudo mkdir -p /etc/systemd/system/jenkins.service.d
printf '[Service]\nEnvironment="JENKINS_PORT=9090"\n' \
  | sudo tee /etc/systemd/system/jenkins.service.d/override.conf
```

적용합니다.

```bash
sudo systemctl daemon-reload
sudo systemctl restart jenkins
sudo systemctl status jenkins --no-pager
```

UFW와 AWS Security Group도 Jenkins 접근 포트인 `9090` 기준으로 맞춥니다.

```bash
sudo ufw allow 9090/tcp
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

- `http://EC2_PUBLIC_IP:9090`에서 Jenkins 로그인 화면이 보임
- Jenkins service active
- `9090` 포트에 Jenkins Java 프로세스가 떠 있음
- Jenkins 사용자가 Docker 명령 실행 가능
- Jenkins Pipeline job에서 `Infra/Jenkinsfile`을 읽을 수 있음

Pipeline 1회 수동 실행 후 다음을 확인합니다.

- Docker Hub에 `ssafer-spring`, `ssafer-fastapi`, `ssafer-nginx` 이미지 push
- EC2 #1 `deploy-ec2-1.sh` 실행 성공
- EC2 #2 SSH 접속 및 `deploy-ec2-2.sh` 실행 성공
