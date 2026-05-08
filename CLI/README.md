# SSAfer CLI

SSAfer CLI는 Docker 기반 프로젝트를 스캔해 보안 설정 문제와 민감정보 노출 가능성을 확인하는 Python Typer 기반 CLI입니다.

`.env`, Dockerfile, Docker Compose 파일을 탐색하고, Custom Rule과 Trivy 결과를 공통 scan JSON으로 저장합니다. 서버 업로드나 AI 분석으로 넘어갈 수 있는 산출물은 원문 secret이 남지 않도록 마스킹을 우선합니다.

---

## 요구사항

- Windows 10/11 또는 Python 실행 가능 환경
- Python 3.10 이상
- Docker Desktop 및 Docker Compose
- Trivy, Dockerfile/이미지 설정 스캔이 필요할 때 사용

---

## 설치

현재 개발/검증 단계에서는 Git URL 직접 설치보다 소스 폴더에서 editable install을 권장합니다.

```powershell
cd CLI
python -m pip install -e ".[dev]"
ssafer version
```

팀원도 저장소를 pull 받아 CLI를 같이 검증하는 경우 위 방식으로 설치하면 됩니다. 코드 변경 후에는 대부분 `git pull`만으로 반영되며, 의존성이 바뀐 경우에만 다시 설치합니다.

```powershell
python -m pip install -e ".[dev]"
```

EC2 Ubuntu 24.04에서는 전역 pip 설치가 막힐 수 있으므로 venv 안에 설치합니다.

```bash
sudo apt install -y python3-venv git

python3 -m venv ~/.ssafer-venv
source ~/.ssafer-venv/bin/activate

cd <repo>/CLI
pip install -e .
ssafer version
```

EC2에 저장소가 없다면 먼저 clone합니다.

```bash
git clone https://lab.ssafy.com/s14-final/S14P31B105.git ~/ssafer-src
cd ~/ssafer-src/CLI
pip install -e .
ssafer version
```

긴 Git URL 설치는 임시 검증용으로만 사용합니다.

```bash
pip install "git+https://lab.ssafy.com/s14-final/S14P31B105.git@develop#subdirectory=CLI"
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
| `ssafer version` | 현재 설치된 CLI 버전 출력 |
| `ssafer doctor` | Python, Docker, Compose, Trivy 환경 점검 |
| `ssafer install-tools` | Trivy 설치 안내 및 Windows winget 설치 시도 |
| `ssafer run --path <dir>` | 프로젝트 스캔 후 `.ssafer/results`에 scan JSON 저장 |
| `ssafer report --path <dir>` | 마지막 스캔 결과 요약 출력 |
| `ssafer report --path <dir> --details` | 스캔 대상, 생성 파일, findings, artifacts 상세 출력 |
| `ssafer login` | 업로드에 사용할 인증 토큰 저장 |
| `ssafer logout` | 저장된 인증 토큰 삭제 |
| `ssafer upload --path <dir>` | 마지막 scan JSON을 백엔드 계약에 맞춰 S3에 업로드 |

---

## 빠른 시작

```powershell
ssafer doctor
ssafer run --path .\my-project
ssafer report --path .\my-project --details
```

업로드가 필요하면 먼저 토큰을 저장합니다.

```powershell
ssafer login
ssafer upload --path .\my-project --api-url http://your-backend:8080
```

`ssafer.yml`에 `upload.endpoint`가 있으면 `--api-url`을 생략할 수 있습니다.

---

## 프로젝트 설정 파일

프로젝트 루트에 `ssafer.yml`을 두면 CLI 기본 동작을 프로젝트별로 조정할 수 있습니다. 파일이 없으면 기존 기본값으로 동작합니다.

```yaml
project_name: S14P31B105

upload:
  endpoint: http://localhost:8080
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

설정 항목:

| 항목 | 설명 |
| --- | --- |
| `project_name` | scan JSON의 `projectName`으로 저장되는 프로젝트 이름 |
| `upload.endpoint` | `ssafer upload`의 기본 백엔드 URL |
| `upload.token_env` | 업로드 토큰을 읽을 환경변수 이름 |
| `rules.exclude` | 실행에서 제외할 Custom Rule ID 목록 |
| `masking.extra_patterns` | 프로젝트별로 추가 적용할 마스킹 정규식 |

잘못된 YAML이나 잘못된 설정 구조는 scan `warnings[]`에 기록하고, 가능한 범위에서 스캔은 계속 진행합니다.

---

## 스캔 대상

SSAfer는 지정한 프로젝트 경로 아래에서 다음 파일을 탐색합니다.

- `.env`, `.env.*`
- `Dockerfile`, `Containerfile`
- `docker-compose.yml`, `docker-compose.yaml`
- `compose.yml`, `compose.yaml`
- `docker-compose.*.yml`, `docker-compose.*.yaml`
- `compose.*.yml`, `compose.*.yaml`

`node_modules`, `.git`, `dist`, `build` 같은 일반적인 생성물 디렉터리는 제외합니다.

---

## 보안 정책

SSAfer CLI는 원문 민감정보가 scan JSON, report, upload payload에 남지 않도록 다음 정책을 적용합니다.

- `.env` 값은 원문 대신 메타데이터와 마스킹된 evidence 중심으로 저장합니다.
- Git ignore된 일반 `.env`의 secret-like 값은 finding으로 보여주지 않고, 마스킹 대상으로만 관리합니다.
- Git에 추적 중인 `.env`의 secret-like 값은 HIGH finding으로 표시합니다.
- `.env.example`에 실제 secret처럼 보이는 값이 있으면 MEDIUM finding으로 표시합니다.
- `your_api_key_here`, `replace_me`, `dummy`, `sample`, `xxx` 같은 placeholder 값은 finding에서 제외합니다.
- Compose `environment`의 `PASSWORD`, `SECRET`, `TOKEN`, `API_KEY` 계열 값은 마스킹합니다.
- Trivy secret 결과의 `Secrets[].Match`와 코드 라인 내 secret-like 값은 scan artifact 저장 전에 마스킹합니다.
- `ssafer upload` 직전에는 최종 scan JSON 전체를 다시 검사하고, 원문 secret 의심값이 있으면 업로드를 중단합니다.

업로드가 차단되면 다음처럼 scan JSON 안의 문제 위치가 출력됩니다.

```text
Upload blocked because the scan package may contain unmasked secrets:
- $.artifacts[0].content.Results[0].Secrets[0].Match
```

이 경로는 파일 라인 번호가 아니라, 업로드 직전 scan JSON 내부에서 문제가 발견된 위치입니다.

---

## 출력 결과

`ssafer run` 실행 후 프로젝트 경로 아래에 `.ssafer` 디렉터리가 생성됩니다.

```text
my-project/
└── .ssafer/
    ├── results/
    │   ├── {scanId}.json
    │   └── last_scan.txt
    ├── effective/
    │   ├── sanitized/
    │   └── raw/              # --save-raw 사용 시에만 저장
    └── trivy/
```

주요 파일:

| 경로 | 설명 |
| --- | --- |
| `.ssafer/results/{scanId}.json` | 최종 scan package |
| `.ssafer/results/last_scan.txt` | 마지막 scan JSON 파일명 |
| `.ssafer/effective/sanitized/*.compose.yml` | 마스킹된 Docker Compose 결과 |
| `.ssafer/effective/raw/*.compose.yml` | `--save-raw` 사용 시 저장되는 원본 effective Compose |
| `.ssafer/trivy/*.json` | Trivy 실행 결과 파일 |

`.ssafer/`는 로컬 산출물이므로 Git에 올리지 않는 것을 권장합니다.

```gitignore
.ssafer/
```

---

## report 상세 출력

```powershell
ssafer report --path .\my-project --details
```

상세 출력에는 다음 정보가 포함됩니다.

- 스캔 ID, 상태, SSAfer 버전, Trivy 버전
- 생성된 scan JSON과 artifact 경로
- 탐색된 `.env`, Dockerfile, Compose 세트
- findings 요약 테이블
- 수집된 artifact 목록

Findings 테이블은 터미널에서 읽기 쉽도록 같은 문제를 묶어 보여줍니다.
긴 제목이나 evidence가 이어져 보이지 않도록 행 사이에 구분선을 넣어 출력합니다.

| 컬럼 | 설명 |
| --- | --- |
| `IDs` | 묶인 finding ID 목록 |
| `Count` | 같은 문제로 묶인 finding 개수 |
| `Severity` | 심각도 |
| `Rule` | rule ID |
| `Location` | 파일 또는 Compose 세트 위치 |
| `Title` | 사용자가 이해할 수 있는 문제 설명 |
| `Evidence` | 마스킹된 근거 값 |

scan JSON의 `findings[]`에는 개별 finding이 그대로 유지됩니다. report 출력만 읽기 쉽게 묶습니다.

---

## 업로드

```powershell
ssafer upload --path .\my-project --api-url http://your-backend:8080
```

`ssafer upload`는 scan JSON을 백엔드 API body로 바로 보내지 않습니다.
현재 백엔드 계약에 맞춰 아래 순서로 동작합니다.

1. `POST /api/v1/scans`로 scan을 등록합니다.
2. 백엔드 응답에서 `scanId`, `rawResultPath`, `rawUploadUrl`을 받습니다.
3. `rawUploadUrl`로 최종 scan JSON을 S3에 `PUT` 업로드합니다.
4. `POST /api/v1/internal/scans/{scanId}/raw-results`로 업로드 완료를 알립니다.

S3 업로드에는 백엔드가 발급한 presigned URL을 사용하므로, 사용자 PC에 AWS credential을 둘 필요는 없습니다.
Bearer token은 백엔드 요청에만 사용하고, S3 presigned URL 요청에는 별도 인증 헤더를 붙이지 않습니다.

업로드 URL 우선순위:

1. CLI 옵션 `--api-url`
2. `ssafer.yml`의 `upload.endpoint`
3. 저장된 기본 endpoint
4. 기본값 `http://localhost:8080`

토큰 우선순위:

1. `ssafer.yml`의 `upload.token_env`에 지정된 환경변수
2. 기본 환경변수 `SSAFER_TOKEN`
3. `ssafer login`으로 저장한 토큰

업로드 직전에는 preflight guard가 최종 scan JSON 전체를 다시 검사합니다.
원문 secret 의심값이 남아 있으면 백엔드 등록이나 S3 업로드 전에 차단됩니다.

---

## 문제 해결

### `No local scan package found.`

`report` 또는 `upload` 전에 먼저 스캔을 실행해야 합니다.

```powershell
ssafer run --path .\my-project
```

### `trivy.exe was not found; Dockerfile scan skipped.`

Trivy가 없으면 Dockerfile 기반 Trivy 스캔은 건너뜁니다.

```powershell
ssafer install-tools
```

설치 후 새 터미널을 열고 다시 실행합니다.

### upload가 민감정보 때문에 차단됨

scan JSON 안에 원문 secret처럼 보이는 값이 남아 있다는 뜻입니다. 차단 메시지의 JSON path를 확인하고, 해당 값이 마스킹되어 저장되도록 scan/sanitize 흐름을 먼저 점검합니다.

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
- `ssafer/core/result_store.py`: scan 생성 흐름
- `ssafer/core/sanitize.py`: 민감정보 마스킹
- `ssafer/core/upload.py`: upload 및 preflight guard
- `ssafer/core/trivy.py`: Trivy 실행 및 결과 처리
- `ssafer/rules/engine.py`: Custom Rule 실행
- `ssafer/rules/env_rules.py`: `.env` finding 정책
- `tests/security_samples.py`: secret 검증용 공통 더미 샘플

추가 문서:

- [`docs/cli_commands.md`](docs/cli_commands.md): CLI 명령어와 생성 파일 정리
- [`docs/cli_regression_tests.md`](docs/cli_regression_tests.md): 회귀 검증 기준
