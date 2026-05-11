# SSAfer CLI

SSAfer CLI는 로컬 프로젝트와 운영 서버를 점검하고, 결과를 SSAfer 백엔드와 웹 화면에 연결하기 위한 도구입니다.

현재 CLI는 크게 세 가지 흐름을 지원합니다.

- 로컬 프로젝트 점검: `.env`, Dockerfile, Docker Compose 파일을 찾아 custom rule과 Trivy 결과를 scan JSON으로 저장
- 서버 런타임 점검: EC2 같은 서버 내부에서 포트, 프로세스, Docker, SSH, firewall, nginx, OS package 상태 점검
- 백엔드 연동: scan JSON을 S3 presigned URL로 업로드하고 백엔드에 raw 결과 업로드 완료를 알림

> 참고: 웹의 "파일 업로드" 스캔은 CLI 결과 JSON 업로드가 아닙니다. 웹 업로드는 `.env`, Dockerfile, compose 파일을 백엔드 서버에 올리고 백엔드가 직접 검사하는 흐름입니다.

---

## 설치

개발/검증 중에는 저장소의 `CLI` 폴더에서 editable install을 사용합니다.

```powershell
cd CLI
python -m pip install -e ".[dev]"
ssafer version
```

EC2 Ubuntu에서는 venv 안에 설치하는 방식을 권장합니다.

```bash
sudo apt install -y python3-venv git

python3 -m venv ~/.ssafer-venv
source ~/.ssafer-venv/bin/activate

cd <repo>/CLI
pip install -e .
ssafer version
```

정식 배포 후 목표 설치 방식은 다음과 같습니다.

```bash
pipx install ssafer
ssafer install-tools
```

---

## 주요 명령어

| 명령어 | 설명 |
| --- | --- |
| `ssafer version` | 설치된 CLI 버전 출력 |
| `ssafer doctor` | Python, Docker, Compose, Trivy 환경 점검 |
| `ssafer install-tools` | Trivy 설치 안내 및 Windows winget 설치 시도 |
| `ssafer login` | 백엔드 로그인 후 토큰 저장. 성공 후 local agent 시작 여부를 묻습니다. |
| `ssafer logout` | 저장된 로그인 토큰 삭제 |
| `ssafer run --path <dir>` | 로컬 프로젝트 점검 후 `.ssafer/results`에 scan JSON 저장 |
| `ssafer run --path <dir> --upload` | 점검 후 바로 최근 scan JSON 업로드 |
| `ssafer report --path <dir>` | 마지막 scan 결과 요약 출력 |
| `ssafer report --path <dir> --details` | findings, warnings, artifacts 상세 출력 |
| `ssafer upload --path <dir>` | 마지막 scan JSON을 백엔드 등록/S3 업로드/raw-results callback 흐름으로 업로드 |
| `ssafer server-audit` | 현재 서버 런타임 상태 점검 |
| `ssafer server-audit --include-os-packages` | OS package 취약점 점검까지 포함 |
| `ssafer server-audit --upload` | 마지막 server-audit JSON을 `scanType=SERVER_AUDIT`로 업로드 |
| `ssafer apply` | 로컬 `analysis_result.json`의 replace patch를 적용 |
| `ssafer agent` | agent token이 없으면 발급/저장 후 local agent 상주 시작 |
| `ssafer agent-init --project-id <id>` | 지정 프로젝트의 agent token 발급/저장 |
| `ssafer agent-watch` | 저장된 agent 설정 또는 env 값으로 pending task 감시 |

---

## 빠른 시작

로컬 프로젝트를 점검하고 터미널에서 결과를 확인합니다.

```powershell
ssafer doctor
ssafer run --path .\my-project
ssafer report --path .\my-project --details
```

웹 기록에 남기려면 로그인 후 업로드합니다.

```powershell
ssafer login
ssafer upload --path .\my-project
```

`ssafer login` 성공 후에는 다음 질문이 표시됩니다.

```text
Login succeeded. Tokens saved to ~/.ssafer/config.yml.
Start local agent now? [y/N]:
```

`y`를 선택하면 `ssafer agent` 흐름으로 이어집니다. 기본값은 `N`입니다.

---

## 백엔드 URL과 인증

기본 API URL은 CLI 내부 기본값 또는 저장된 설정을 사용합니다. 명령어별로 `--api-url`을 지정할 수도 있습니다.

우선순위:

1. CLI 옵션 `--api-url`
2. `ssafer.yml`의 `upload.endpoint`
3. `ssafer login` 또는 `save_token`으로 저장된 endpoint
4. CLI 기본 endpoint

인증 토큰 우선순위:

1. `ssafer.yml`의 `upload.token_env`에 지정된 환경변수
2. 기본 환경변수 `SSAFER_TOKEN`
3. `ssafer login`으로 저장된 access token

로그인, 회원가입, 업로드 등록, raw-results callback 같은 백엔드 POST 요청은 301/302/303/307/308 redirect가 발생해도 POST method를 유지하도록 처리합니다. S3 presigned URL 요청에는 Authorization 헤더를 붙이지 않습니다.

---

## 프로젝트 설정 파일

프로젝트 루트에 `ssafer.yml`을 두면 CLI 기본 동작을 프로젝트별로 조정할 수 있습니다.

```yaml
project_name: S14P31B105

upload:
  endpoint: https://k14b105.p.ssafy.io
  token_env: SSAFER_TOKEN

rules:
  exclude:
    - COMPOSE_LATEST_TAG

masking:
  extra_patterns:
    - name: internal_domain
      regex: "company-internal\\.com"
      mask: "[REDACTED]"
```

| 항목 | 설명 |
| --- | --- |
| `project_name` | scan JSON의 `projectName` 기본값 |
| `upload.endpoint` | 업로드 기본 백엔드 URL |
| `upload.token_env` | 업로드 토큰을 읽을 환경변수 이름 |
| `rules.exclude` | 제외할 custom rule ID 목록 |
| `masking.extra_patterns` | 추가 마스킹 정규식 |

---

## 로컬 프로젝트 점검

`ssafer run`은 지정한 경로 아래에서 다음 파일을 탐색합니다.

- `.env`, `.env.*`
- `Dockerfile`, `Containerfile`
- `docker-compose.yml`, `docker-compose.yaml`
- `docker-compose.*.yml`, `docker-compose.*.yaml`
- `compose.yml`, `compose.yaml`
- `compose.*.yml`, `compose.*.yaml`

일반 생성물/캐시 디렉터리는 제외합니다.

- `.git`
- `node_modules`
- `dist`
- `build`
- `.pytest_tmp`
- `.pytest_cache`

출력은 프로젝트 루트 아래 `.ssafer`에 저장됩니다.

```text
.ssafer/
  results/
    {scanId}.json
    last_scan.txt
  effective/
    sanitized/
    raw/
  trivy/
```

---

## 업로드 흐름

`ssafer upload`는 로컬 scan JSON을 백엔드 API body에 직접 싣지 않습니다. 현재 백엔드 계약에 맞춰 다음 순서로 동작합니다.

1. `POST /api/v1/scans`로 scan row를 등록합니다.
2. 백엔드 응답에서 `scanId`, `rawResultPath`, `rawUploadUrl`을 받습니다.
3. `rawUploadUrl`로 scan JSON bytes를 S3에 `PUT` 업로드합니다.
4. `POST /api/v1/scans/{scanId}/raw-results`로 업로드 완료를 알립니다.

업로드 완료 callback payload에는 다음 값이 포함됩니다.

- `tool`
- `toolVersion`
- `resultCount`
- `payloadHash`

`payloadHash`는 실제 업로드한 JSON bytes 기준 SHA-256입니다.

현재 `ssafer upload`가 완료되면 웹 scan 목록에는 기록이 생성됩니다. 다만 AI/Worker가 raw JSON을 분석하고 `analysis-results` callback을 호출해야 최종 `DONE`으로 넘어갑니다.

---

## server-audit

`ssafer server-audit`는 로컬 프로젝트 파일이 아니라 현재 서버 런타임 상태를 점검합니다.

점검 항목:

- ports
- processes
- docker
- ssh
- firewall
- nginx
- os-packages, `--include-os-packages` 지정 시

기본 실행:

```bash
ssafer server-audit
```

OS package 취약점까지 포함:

```bash
ssafer server-audit --include-os-packages
```

상세 출력:

```bash
ssafer server-audit --details
```

업로드:

```bash
ssafer server-audit --upload
```

업로드 시 payload에는 일반 project scan과 구분하기 위해 다음 값을 포함합니다.

```json
{
  "source": "SERVER_AUDIT",
  "scanType": "SERVER_AUDIT"
}
```

현재 백엔드가 `scanType=SERVER_AUDIT`와 `source=SERVER_AUDIT`를 허용해야 E2E 업로드가 완료됩니다.

---

## local agent

`ssafer agent`는 사용자의 로컬 프로젝트 폴더에서 백엔드 agent task를 감시하기 위한 명령입니다.

처음 실행하면 다음을 수행합니다.

1. 저장된 agent 설정을 확인합니다.
2. 설정이 없으면 로그인 token으로 프로젝트 목록을 조회합니다.
3. 사용자가 연결할 프로젝트를 선택합니다.
4. `POST /api/v1/projects/{projectId}/agent/token`으로 agent token을 발급받습니다.
5. `~/.ssafer/config.yml`에 `agentId`, `projectId`, `agentToken`, `endpoint`를 저장합니다.
6. WebSocket 연결 및 pending task 조회를 시작합니다.

```powershell
ssafer login
ssafer agent
```

저장된 agent 설정이 있으면 다음부터는 바로 상주를 시작합니다.

```powershell
ssafer agent
```

현재 agent가 처리하는 task:

- `PATCH_APPLY`: 구조화된 replace patch payload를 로컬 파일에 적용

아직 처리하지 않는 task:

- `SCAN_REQUEST`: 웹에서 Agent 스캔 요청을 눌렀을 때 로컬에서 자동으로 `ssafer run`과 업로드를 수행하는 흐름

즉 현재 `ssafer agent`는 patch 적용 기반과 연결/재연결/조회 기반은 있지만, 웹 Agent 스캔 요청을 받아 자동 스캔하는 기능은 다음 작업 범위입니다.

WebSocket은 `/ws/v1/internal/agents/connect`를 사용합니다. `https://k14b105.p.ssafy.io` endpoint를 사용할 때 agent WebSocket은 `wss://ssafer.co.kr/ws/v1/internal/agents/connect`로 연결하도록 보정합니다.

---

## apply

`ssafer apply`는 AI 분석 결과의 patch payload를 로컬 파일에 적용합니다.

```powershell
ssafer apply --path .\my-project --analysis-result .\analysis_result.json
```

지원하는 patch operation:

- `replace`

안전 정책:

- `filePath`는 프로젝트 루트 밖으로 나갈 수 없습니다.
- `oldText`가 대상 파일 안에서 정확히 한 번만 발견될 때만 교체합니다.
- 적용 전 diff preview를 출력합니다.
- 적용 전 백업 파일을 `.ssafer/backups` 아래에 저장합니다.
- `--dry-run`은 파일을 수정하지 않고 적용 가능 여부만 확인합니다.
- `--patch-id`로 특정 patch만 선택할 수 있습니다.

현재 `ssafer apply`는 로컬 `analysis_result.json`을 기준으로 동작합니다. S3/백엔드의 최신 `analysis_result.json`을 scanId로 받아오는 기능은 아직 없습니다.

---

## 웹 스캔 방식과 CLI 관계

웹에는 다음 스캔 방식이 있습니다.

### 파일 업로드

CLI가 관여하지 않습니다. 사용자가 웹에 `.env`, Dockerfile, compose 파일을 업로드하면 백엔드 서버가 직접 custom rule과 Trivy를 실행합니다.

사용자 PC에는 CLI나 Trivy가 없어도 됩니다. 대신 백엔드 서버에는 Trivy 명령이 설치되어 있어야 합니다.

### CLI

사용자가 직접 로컬에서 실행합니다.

```powershell
ssafer run
ssafer upload
```

`ssafer upload`까지 완료해야 웹 scan 목록에 기록이 남습니다.

### Agent

목표 흐름은 다음과 같습니다.

```text
웹에서 Agent 스캔 시작
→ 백엔드가 SCAN_REQUEST task 생성
→ 실행 중인 ssafer agent가 task 수신
→ 로컬에서 scan 실행
→ 결과 업로드
→ 웹에서 진행 상태와 결과 확인
```

현재 CLI는 `SCAN_REQUEST` 자동 실행부가 아직 없습니다. 따라서 이 흐름은 다음 작업에서 구현해야 합니다.

---

## 보안 정책

- `.env` 원문 secret 값은 scan JSON, report, upload payload에 남지 않도록 마스킹합니다.
- Compose `environment`의 `PASSWORD`, `SECRET`, `TOKEN`, `API_KEY` 계열 값은 마스킹합니다.
- Trivy secret 결과의 `Secrets[].Match`와 코드 라인 내 secret-like 값은 scan artifact 저장 전에 마스킹합니다.
- `ssafer upload` 직전에는 최종 scan JSON 전체를 다시 검사하고, 원문 secret 의심값이 있으면 백엔드/S3 요청 전에 차단합니다.
- HTTP 오류 출력 시 S3 presigned URL은 숨기고 백엔드 API URL만 표시합니다.

---

## 문제 해결

### `No local scan package found.`

`report` 또는 `upload` 전에 먼저 스캔을 실행해야 합니다.

```powershell
ssafer run --path .\my-project
```

### `trivy.exe was not found; Dockerfile scan skipped.`

Trivy가 없으면 Dockerfile 기반 Trivy scan은 건너뜁니다.

```powershell
ssafer install-tools
```

설치 후 새 터미널을 열고 다시 실행합니다.

### `server-audit --include-os-packages`가 오래 걸림

OS package 취약점 점검은 `trivy rootfs /`를 실행하므로 시간이 걸릴 수 있습니다. CLI는 장시간 작업 전에 진행 안내를 출력하고, OS package 점검은 더 긴 timeout을 사용합니다.

### `ssafer agent` WebSocket 연결 실패

다음과 같은 오류가 나면 CLI보다는 인프라 WebSocket proxy 문제일 가능성이 큽니다.

```text
server rejected WebSocket connection: HTTP 200
```

`/ws/v1/internal/agents/connect`가 WebSocket upgrade로 백엔드에 전달되어야 합니다.

---

## 개발자 참고

```powershell
cd CLI
pip install -e ".[dev]"
python -m pytest
```

주요 모듈:

- `ssafer/main.py`: Typer 명령어 정의
- `ssafer/core/config.py`: `ssafer.yml` 설정 로더
- `ssafer/core/result_store.py`: scan 결과 저장
- `ssafer/core/sanitize.py`: 민감정보 마스킹
- `ssafer/core/upload.py`: scan/server-audit 업로드 및 redirect-preserving POST 처리
- `ssafer/core/agent.py`: agent WebSocket 연결, pending task 조회, `PATCH_APPLY` 처리
- `ssafer/core/patches.py`: replace patch 적용
- `ssafer/core/trivy.py`: Trivy 실행 및 결과 처리
- `ssafer/server/audit.py`: server-audit 점검 로직
- `ssafer/rules/engine.py`: custom rule 실행
- `ssafer/rules/env_rules.py`: `.env` finding 정책

추가 문서:

- [`docs/cli_commands.md`](docs/cli_commands.md)
- [`docs/cli_regression_tests.md`](docs/cli_regression_tests.md)
