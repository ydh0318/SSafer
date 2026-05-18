# SSAfer CLI

SSAfer CLI는 프로젝트 설정 파일과 서버 런타임 상태를 점검하고, 결과를 SSAfer 웹 대시보드와 연결하는 터미널 도구입니다.

현재 CLI에서 할 수 있는 일은 크게 네 가지입니다.

- 로컬 프로젝트 점검: `.env`, Dockerfile, Docker Compose 파일을 분석해 scan JSON 생성
- 서버 점검: EC2 같은 서버 내부에서 포트, 프로세스, Docker, SSH, firewall, nginx, OS package 상태 확인
- 업로드: 로컬 scan JSON 또는 server-audit JSON을 백엔드/S3로 업로드
- Local Agent: 웹에서 보낸 스캔/수정 요청을 현재 PC 또는 서버에서 처리

---

## 설치

### 개발 중 설치

저장소를 받은 상태라면 `CLI` 폴더에서 editable install을 사용합니다.

```powershell
cd CLI
python -m pip install -e ".[dev]"
ssafer version
```

코드를 수정하면 다시 설치하지 않아도 바로 반영됩니다.

### EC2 또는 서버 검증용 설치

Ubuntu 24.04처럼 전역 pip 설치가 막힌 환경에서는 venv를 만든 뒤 설치합니다.

```bash
sudo apt install -y python3-venv git

python3 -m venv ~/.ssafer-venv
source ~/.ssafer-venv/bin/activate

pip install "git+https://lab.ssafy.com/s14-final/S14P31B105.git@develop#subdirectory=CLI"
ssafer version
```

이 설치 명령은 어느 폴더에서 실행해도 됩니다. pip가 임시 디렉터리에 저장소를 받아 설치하기 때문입니다.

다만 venv에 설치했다면 `ssafer` 명령을 실행할 때도 venv가 활성화되어 있어야 합니다.

```bash
source ~/.ssafer-venv/bin/activate
ssafer --help
```

코드가 바뀐 develop 브랜치를 다시 설치하려면 아래처럼 강제 재설치합니다.

```bash
pip install --upgrade --force-reinstall "git+https://lab.ssafy.com/s14-final/S14P31B105.git@develop#subdirectory=CLI"
```

### 최종 배포 설치

최종 배포 후 사용자는 PyPI에 올라간 `ssafer` 패키지를 설치합니다.

```bash
pip install ssafer
ssafer version
```

CLI 도구만 독립 환경에 설치하려면 `pipx` 사용을 권장합니다.

```bash
pipx install ssafer
ssafer version
```

업데이트는 아래처럼 진행합니다.

```bash
pipx upgrade ssafer
# 또는
pip install --upgrade ssafer
```

`pipx`는 PyPI 패키지를 사용자 환경의 독립 venv에 설치해 주는 도구입니다. 사용자는 venv를 직접 활성화하지 않아도 `ssafer` 명령을 바로 사용할 수 있습니다.

PyPI는 같은 버전을 다시 업로드할 수 없습니다. 배포할 때마다 버전을 올린 뒤 새로 빌드해 업로드해야 합니다.

---

## 자주 쓰는 명령어

| 명령어 | 설명 |
| --- | --- |
| `ssafer version` | 현재 설치된 SSAfer CLI 버전을 확인합니다. |
| `ssafer status` | 로그인, 계정 방식, endpoint, Local Agent 상태를 확인합니다. |
| `ssafer tools` | Trivy 같은 점검 도구를 설치합니다. |
| `ssafer signup` | 이메일 인증부터 회원가입까지 터미널에서 진행합니다. |
| `ssafer login` | 회원 계정으로 로그인하고 업로드/agent용 토큰을 저장합니다. |
| `ssafer guest` | 이메일 없이 게스트 토큰을 발급받아 CLI를 사용합니다. |
| `ssafer logout` | 저장된 로그인/agent 정보를 삭제합니다. |
| `ssafer withdraw` | 현재 로그인한 회원 계정을 탈퇴합니다. |
| `ssafer run` | 현재 폴더 기준으로 프로젝트 설정 파일을 스캔합니다. |
| `ssafer run --upload` | 스캔 후 바로 업로드하고 AI 분석 완료까지 기다립니다. |
| `ssafer report` | 최근 로컬 스캔 결과 요약을 확인합니다. |
| `ssafer report --details` | 최근 로컬 스캔 결과의 상세 finding을 확인합니다. |
| `ssafer upload` | 최근 로컬 프로젝트 스캔 결과를 업로드합니다. |
| `ssafer server` | 현재 서버의 런타임 보안 상태를 점검합니다. |
| `ssafer server --upload` | 서버 점검을 실행한 뒤 결과를 바로 업로드합니다. |
| `ssafer upload --server` | 최근 서버 점검 결과를 새로 점검하지 않고 업로드합니다. |
| `ssafer apply` | 최근 DONE scan의 AI 수정안을 내려받아 적용합니다. |
| `ssafer apply <scan_id>` | 지정한 scanId의 AI 수정안을 내려받아 적용합니다. |
| `ssafer agent` | 웹 요청을 현재 PC/서버에서 처리하도록 Local Agent를 실행합니다. |

---

## 계정과 게스트 모드

회원 계정으로 사용하려면 로그인합니다.

```bash
ssafer login
```

로그인 후 CLI는 `~/.ssafer/config.yml`에 access token과 endpoint를 저장합니다. 이 토큰은 CLI 업로드와 Local Agent 연결에 사용됩니다. 브라우저 웹 로그인과는 별도입니다.

게스트로 바로 사용하려면 아래 명령을 사용합니다.

```bash
ssafer guest
```

토큰이 포함된 웹 연결 URL은 기본 출력에서 숨깁니다. 실제 URL이 필요할 때만 아래 명령을 사용합니다.

```bash
ssafer guest --show-url
```

웹에서 받은 게스트 토큰을 CLI에 붙여 쓰는 경우:

```bash
ssafer login --guest-token <웹에서 받은 토큰>
```

현재 상태는 언제든 확인할 수 있습니다.

```bash
ssafer status
```

---

## 로컬 프로젝트 스캔

프로젝트 루트에서 실행하는 것이 가장 좋습니다.

```bash
ssafer run
```

다른 위치에서 실행해야 하면 `--path`로 대상 프로젝트 경로를 지정합니다.

```bash
ssafer run --path /path/to/project
```

스캔 결과는 대상 프로젝트 아래 `.ssafer/results`에 저장됩니다.

```text
.ssafer/
  results/
    {localScanId}.json
    last_scan.txt
  effective/
    sanitized/
    raw/
  trivy/
```

`ssafer run`에서 표시되는 로컬 스캔 ID는 CLI 내부 결과 파일 ID입니다. 웹에서 쓰는 백엔드 `scanId`는 업로드 후 별도로 발급됩니다.

최근 스캔 요약:

```bash
ssafer report
```

상세 finding:

```bash
ssafer report --details
```

---

## 로컬 스캔 업로드

최근 로컬 스캔 결과를 업로드합니다.

```bash
ssafer upload
```

스캔과 업로드를 한 번에 실행하려면:

```bash
ssafer run --upload
```

업로드 흐름은 다음과 같습니다.

1. `POST /api/v1/scans`로 scan 등록
2. 백엔드가 `scanId`, `rawUploadUrl`, `rawResultPath` 반환
3. CLI가 `rawUploadUrl`로 scan JSON을 S3에 PUT
4. `POST /api/v1/scans/{scanId}/raw-results`로 업로드 완료 보고
5. AI 분석이 끝날 때까지 상태 조회
6. 웹 결과 URL 출력

S3 presigned URL에는 Authorization 헤더를 붙이지 않습니다. 백엔드 API 호출에만 로그인 토큰을 사용합니다.

---

## 서버 점검

EC2 또는 서버 내부에서 서버 런타임 상태를 점검하려면 아래 명령을 사용합니다.

```bash
ssafer server
```

서버 점검은 프로젝트 파일을 보는 것이 아니라 현재 서버의 런타임 상태를 봅니다.

확인 대상:

- 열려 있는 포트
- 실행 중인 프로세스
- Docker 컨테이너
- SSH 설정
- firewall 상태
- nginx 설정
- OS package 취약점

OS package 취약점까지 보려면 시간이 오래 걸릴 수 있으므로 명시적으로 옵션을 붙입니다.

```bash
ssafer server --include-os-packages
```

서버 점검 결과는 기본적으로 홈 디렉터리 아래에 저장됩니다.

```text
~/.ssafer/server-audit/{auditId}.json
~/.ssafer/server-audit/last_audit.txt
```

현재 위치가 `/var/lib`, Jenkins workspace처럼 쓰기 권한이 애매한 경로여도 결과 저장은 홈 디렉터리로 fallback됩니다.

### 서버 점검 결과 업로드

서버 점검과 업로드를 한 번에 실행:

```bash
ssafer server --upload
```

이미 실행한 최근 서버 점검 결과만 업로드:

```bash
ssafer upload --server
```

즉, `ssafer server --upload`는 “새로 점검 + 업로드”이고, `ssafer upload --server`는 “최근 서버 점검 결과 업로드만”입니다.

server-audit 업로드는 일반 프로젝트 스캔과 같은 업로드 흐름을 재사용하지만, payload에 아래 값을 포함해 구분합니다.

```json
{
  "source": "SERVER_AUDIT",
  "scanType": "SERVER_AUDIT"
}
```

---

## Local Agent

웹에서 “Agent 스캔” 또는 “수정 적용”을 누르면 브라우저가 직접 로컬 파일이나 서버 명령어를 실행할 수 없습니다. 이때 현재 PC 또는 서버에서 `ssafer agent`가 실행 중이어야 합니다.

```bash
ssafer agent
```

처음 실행하면 연결할 프로젝트를 선택하거나 생성합니다. 웹에서 해당 프로젝트로 보낸 요청을 이 agent가 처리합니다.

Agent가 처리하는 주요 task:

- `SCAN_REQUEST`: 웹에서 요청한 프로젝트 스캔 실행 및 업로드
- `PATCH_APPLY`: 웹에서 승인한 수정안을 로컬 파일에 적용하고 결과 보고

로그인 직후에도 CLI가 agent 실행 여부를 물어봅니다.

```text
지금 Local Agent를 시작할까요? [y/N]:
```

나중에 켜려면 언제든 아래 명령을 실행하면 됩니다.

```bash
ssafer agent
```

---

## 수정 적용

AI 분석이 완료된 scan의 수정안을 내려받아 적용합니다.

```bash
ssafer apply
```

기본 동작은 현재 프로젝트의 최신 DONE scan을 찾아 적용하는 것입니다.

특정 scanId를 지정하려면:

```bash
ssafer apply 123
```

파일을 실제로 바꾸지 않고 확인만 하려면:

```bash
ssafer apply --dry-run
```

적용 전에는 diff preview가 표시됩니다. 적용 시에는 `.ssafer/backups` 아래에 백업 파일을 남깁니다.

자동 수정 payload가 없으면 실패가 아니라 “적용할 수정안 없음”으로 안내합니다. 이 경우 AI가 patch 대신 가이드만 생성한 상태일 수 있습니다.

---

## scan JSON과 patchContext

CLI scan JSON의 finding에는 AI가 자동 수정 payload를 만들 수 있도록 아래 정보가 포함될 수 있습니다.

- `filePath`: 실제 수정 대상 파일
- `line`: finding이 발견된 줄 번호
- `targetFiles`: 후보 파일 목록
- `patchContext.operation`: `replace` 또는 `append`
- `patchContext.oldText`: replace 기준 원문
- `patchContext.newTextHint`: append 또는 생성형 수정 힌트
- `patchContext.expectedFileHash`: 대상 파일 SHA-256 해시

AI/Worker는 이 정보를 기반으로 `analysis_result.json`의 `patches` 배열을 생성합니다.

replace patch 예시:

```json
{
  "patchId": "PATCH-FND-0001",
  "findingId": "FND-0001",
  "operation": "replace",
  "filePath": "docker-compose.yml",
  "oldText": "    ports:\n      - \"5432:5432\"",
  "newText": "",
  "expectedFileHash": "sha256:..."
}
```

append patch 예시:

```json
{
  "patchId": "PATCH-FND-0006",
  "findingId": "FND-0006",
  "operation": "append",
  "filePath": "Dockerfile",
  "oldText": null,
  "newText": "\nHEALTHCHECK CMD curl -f http://localhost/ || exit 1\n",
  "expectedFileHash": "sha256:..."
}
```

server-audit는 코드 patch 대상이 아니라 운영 조치 제안 중심입니다.

---

## 설정 파일

프로젝트 루트에 `ssafer.yml`을 두면 일부 기본값을 바꿀 수 있습니다.

```yaml
project_name: S14P31B105

upload:
  endpoint: https://ssafer.co.kr
  token_env: SSAFER_TOKEN

rules:
  exclude:
    - COMPOSE_LATEST_TAG
```

| 항목 | 설명 |
| --- | --- |
| `project_name` | scan JSON의 프로젝트 이름 기본값 |
| `upload.endpoint` | 백엔드 API URL |
| `upload.token_env` | 업로드 토큰을 읽을 환경변수 이름 |
| `rules.exclude` | 제외할 custom rule ID |

---

## 빌드와 배포 준비

PyPI 배포는 계정 권한과 API token이 필요합니다. 처음 배포 전 PyPI 또는 TestPyPI 계정을 만들고, 계정 설정에서 API token을 발급받아 `twine` 업로드 시 사용합니다.

### 빌드 도구 설치

```bash
cd CLI
python -m pip install --upgrade build twine
```

### 버전 올리기

PyPI는 같은 버전을 다시 업로드할 수 없으므로 배포마다 버전을 올려야 합니다.

현재 버전은 아래 두 곳을 함께 맞춥니다.

- `CLI/pyproject.toml`의 `version`
- `CLI/ssafer/__init__.py`의 `__version__`

### 이전 빌드 삭제 후 재빌드

```bash
rm -rf dist/
python -m build
python -m twine check dist/*
```

Windows PowerShell에서는 이전 빌드 삭제를 아래처럼 실행할 수 있습니다.

```powershell
Remove-Item -Recurse -Force dist
```

### TestPyPI 사전 배포

처음 배포하거나 metadata를 바꾼 경우 실제 PyPI 전에 TestPyPI에서 먼저 확인하는 것을 권장합니다.

```bash
python -m twine upload --repository testpypi dist/*
```

TestPyPI 배포본 설치 확인:

```bash
pipx install --index-url https://test.pypi.org/simple/ --pip-args="--extra-index-url https://pypi.org/simple" ssafer
```

또는 venv/pip 환경에서:

```bash
python -m pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple ssafer
```

확인:

```bash
ssafer version
ssafer --help
```

### 실제 PyPI 배포

TestPyPI 검증이 끝나면 실제 PyPI에 업로드합니다.

```bash
python -m twine upload dist/*
```

첫 업로드 후 패키지 페이지가 생성됩니다.

https://pypi.org/project/ssafer/

첫 배포 후에는 계정 전체 token보다 프로젝트 범위 token으로 교체하는 것이 더 안전합니다.

### 사용자 설치와 업데이트

설치:

```bash
pip install ssafer
ssafer version
```

또는:

```bash
pipx install ssafer
```

업데이트:

```bash
pipx upgrade ssafer
# 또는
pip install --upgrade ssafer
```
