# GitLab Webhook Setup

`S14P31B105-158` 기준 GitLab Webhook 연동 가이드입니다.

## 목표

GitLab의 `develop` 브랜치 push 또는 MR merge 후 Jenkins 파이프라인이 자동 실행되도록 연결합니다.

## Jenkins Job 전제

- Job 유형: Pipeline
- Definition: Pipeline script from SCM
- Branch: `develop`
- Script Path: `Infra/Jenkinsfile`
- Jenkins URL: `https://k14b105.p.ssafy.io/jenkins/` (nginx 프록시 경유)

## Jenkins 설정

Jenkins에서 GitLab 플러그인을 설치합니다.

- GitLab Plugin
- GitLab Hook Plugin
- SSH Agent Plugin
- Docker Pipeline 또는 Docker CLI 사용 가능 환경

Job 설정에서 Build Trigger를 활성화합니다.

- `Build when a change is pushed to GitLab`
- Secret token 생성 후 복사
- push events 활성화
- merge request events는 팀 정책에 맞게 선택

Jenkins Job webhook endpoint 예시:

```text
https://k14b105.p.ssafy.io/jenkins/project/<JENKINS_JOB_NAME>
```

## GitLab 설정

GitLab 프로젝트에서 아래 경로로 이동합니다.

```text
Settings > Webhooks
```

Webhook 값을 등록합니다.

```text
URL: https://k14b105.p.ssafy.io/jenkins/project/<JENKINS_JOB_NAME>
Secret token: Jenkins Job에서 생성한 token
Trigger: Push events
SSL verification: 활성화
```

GitLab Webhook 화면에 branch filter 항목이 없으면 Jenkins Job의 GitLab trigger 설정에서 브랜치를 제한합니다.

```text
Allowed branches: Filter branches by name
Include: develop
```

기능 브랜치에서 Webhook 연동을 먼저 검증할 때는 Pipeline SCM의 Branch Specifier와 Allowed branches를 같은 브랜치로 맞춥니다.

```text
Branch Specifier: */feature/S14P31B105-163-prod-deploy-validation
Allowed branches Include: feature/S14P31B105-163-prod-deploy-validation
```

MR merge 후 운영 자동 배포 기준으로 전환할 때는 둘 다 `develop`으로 되돌립니다.

```text
Branch Specifier: */develop
Allowed branches Include: develop
```

## 검증

GitLab Webhook 화면에서 `Test > Push events`를 실행합니다.

성공 기준:

- GitLab Webhook test가 HTTP 200 또는 201 응답
- Jenkins Job이 자동으로 큐에 들어감
- Jenkins console log에서 checkout, docker build stage 진입 확인
- Jenkins console log 상단에서 GitLab push event 또는 remote trigger로 시작된 것을 확인

## 운영 주의사항

- Jenkins를 public `9090`으로 직접 열 경우 접근 제어가 필요합니다.
- 가능하면 NGINX reverse proxy, Jenkins 인증, IP 제한 중 하나 이상을 적용합니다.
- Webhook token은 외부에 노출하지 않습니다.
- `develop` 외 브랜치 자동 배포는 운영 안정성을 위해 Jenkins Allowed branches에서 제한합니다.

## Jira 완료 코멘트

```markdown
GitLab Webhook 연동 완료

- Jenkins Pipeline Job 생성
- GitLab push event webhook 등록
- develop branch filter 적용
- Webhook secret token 설정
- GitLab Test push event로 Jenkins Job 자동 실행 확인

검증:
- GitLab Webhook test 응답 성공
- Jenkins console log에서 checkout/build stage 진입 확인
```
