# SSAfer CLI

SSAfer CLI는 로컬 프로젝트와 서버 환경의 보안 상태를 점검하고, 결과를 SSAfer 웹 대시보드로 업로드하는 터미널 도구입니다.

처음 보는 사용자는 아래 순서만 따라 하면 됩니다.

```bash
pip install ssafer
ssafer tools
cd <프로젝트 루트>
ssafer signup
ssafer login
ssafer run --upload
ssafer apply
```

이미 계정이 있으면 `ssafer signup`은 건너뛰고 `ssafer login`부터 실행하면 됩니다.

CLI 안에서 같은 내용을 다시 보고 싶으면:

```bash
ssafer guide
```

---

## 1. 설치

### 일반 설치

```bash
pip install ssafer
ssafer version
```

CLI 도구를 독립 환경에 설치하고 싶으면 `pipx`를 권장합니다.

```bash
pipx install ssafer
ssafer version
```

업데이트:

```bash
pip install --upgrade ssafer
# 또는
pipx upgrade ssafer
```

---

## 2. 스캔 도구 설치

SSAfer는 Dockerfile 점검에 Trivy를 사용합니다. 처음 한 번 실행하세요.

```bash
ssafer tools
```

이미 Trivy가 설치되어 있으면 그대로 사용합니다.

---

## 3. 로그인

계정이 없다면 먼저 회원가입합니다.

```bash
ssafer signup
```

`ssafer signup`은 이메일 인증 코드 발송, 코드 입력, 코드 검증, 회원가입까지 한 번에 진행합니다.

회원 계정으로 업로드하려면:

```bash
ssafer login
```

게스트로 빠르게 테스트하려면:

```bash
ssafer guest
```

게스트 세션을 웹에서 이어 보려면:

```bash
ssafer guest --show-url
```

현재 로그인 상태와 Agent 연결 상태 확인:

```bash
ssafer status
```

로그아웃:

```bash
ssafer logout
```

---

## 4. 로컬 프로젝트 스캔

프로젝트 루트로 이동합니다.

```bash
cd <프로젝트 루트>
```

프로젝트 루트는 보통 `.env`, `Dockerfile`, `docker-compose.yml`이 있는 폴더입니다.

스캔만 실행:

```bash
ssafer run
```

최근 스캔 결과 확인:

```bash
ssafer report
ssafer report --details
```

스캔 결과는 프로젝트 안의 `.ssafer/results`에 저장됩니다.

```text
<프로젝트 루트>/
  .ssafer/
    results/
      {localScanId}.json
      last_scan.txt
```

---

## 5. 스캔과 업로드를 한 번에 실행

가장 많이 쓰는 명령입니다.

```bash
ssafer run --upload
```

이 명령은 아래 작업을 한 번에 처리합니다.

1. 프로젝트 설정 파일 스캔
2. 민감정보 마스킹
3. scan JSON 생성
4. 백엔드 scan 등록
5. S3 업로드
6. AI 분석 완료 대기
7. 웹 결과 URL 출력

이미 `ssafer run`을 실행한 뒤 최근 결과만 업로드하려면:

```bash
ssafer upload
```

---

## 6. AI 수정안 적용

AI 분석이 끝난 뒤 자동 수정 가능한 항목이 있으면 로컬 파일에 적용할 수 있습니다.

최신 완료 스캔 기준:

```bash
ssafer apply
```

특정 scanId 기준:

```bash
ssafer apply 123
```

파일을 바꾸지 않고 diff만 확인:

```bash
ssafer apply --dry-run
```

적용 전에 diff preview가 표시되고, 실제 적용 시 `.ssafer/backups`에 백업 파일이 생성됩니다.

자동 수정안이 없으면 파일을 변경하지 않고 권장 조치 안내만 확인하면 됩니다.

---

## 7. 서버 런타임 점검

EC2 같은 서버 내부에서 실행합니다.

```bash
ssafer server
```

서버 점검은 프로젝트 파일이 아니라 현재 서버의 런타임 상태를 확인합니다.

- 열린 포트
- 실행 중인 프로세스
- Docker 컨테이너와 포트 publish 상태
- SSH 설정
- firewall, ufw, iptables
- nginx 설정
- 선택 시 OS package 취약점

점검과 업로드를 한 번에 실행:

```bash
ssafer server --upload
```

OS package까지 포함:

```bash
ssafer server --include-os-packages --upload
```

이미 만든 최근 서버 점검 결과만 업로드:

```bash
ssafer upload --server
```

서버 점검 결과는 기본적으로 홈 디렉터리에 저장됩니다.

```text
~/.ssafer/server-audit/{auditId}.json
~/.ssafer/server-audit/last_audit.txt
```

---

## 8. 웹에서 Local Agent로 실행

웹에서 Agent 스캔이나 수정 적용을 누르려면, 스캔할 PC 또는 서버에서 Agent가 실행 중이어야 합니다.

```bash
cd <프로젝트 루트>
ssafer login
ssafer agent
```

처음 실행하면 연결할 프로젝트를 선택하거나 새 프로젝트를 만들 수 있습니다.

Agent가 실행 중이면 웹에서 보낸 요청을 현재 터미널이 처리합니다.

- 프로젝트 파일 스캔
- 서버 런타임 점검
- 승인된 patch 적용
- 결과 업로드와 task 결과 보고

Agent를 끄려면 터미널에서 `Ctrl+C`를 누릅니다.

---

## 9. 자주 쓰는 명령어

| 명령어 | 설명 |
| --- | --- |
| `ssafer guide` | 설치 후 전체 사용 흐름을 터미널에서 확인합니다. |
| `ssafer version` | 설치된 CLI 버전을 확인합니다. |
| `ssafer tools` | Trivy 같은 외부 점검 도구를 설치합니다. |
| `ssafer signup` | 이메일 인증 후 회원가입합니다. |
| `ssafer login` | 회원 계정으로 로그인합니다. |
| `ssafer guest` | 게스트 토큰으로 테스트합니다. |
| `ssafer status` | 로그인, endpoint, Agent 상태를 확인합니다. |
| `ssafer run` | 프로젝트를 스캔하고 로컬 JSON을 저장합니다. |
| `ssafer run --upload` | 스캔, 업로드, AI 분석 대기를 한 번에 실행합니다. |
| `ssafer report --details` | 최근 로컬 스캔 결과 상세를 봅니다. |
| `ssafer upload` | 최근 로컬 프로젝트 스캔 결과를 업로드합니다. |
| `ssafer server --upload` | 서버 런타임 점검 후 업로드합니다. |
| `ssafer upload --server` | 최근 서버 점검 결과만 업로드합니다. |
| `ssafer apply` | 최신 AI 수정안을 적용합니다. |
| `ssafer agent` | 웹 요청을 현재 PC 또는 서버에서 처리합니다. |

---

## 10. 어떤 파일을 보나요?

로컬 프로젝트 스캔은 주로 아래 파일을 확인합니다.

- `.env`, `.env.*`
- `Dockerfile`, `Containerfile`
- `docker-compose.yml`, `compose.yml`
- Compose override 파일

점검 결과에는 민감정보 원문이 그대로 들어가지 않도록 마스킹합니다.

---

## 11. 업로드할 때 안전한가요?

SSAfer CLI는 사용자의 PC 또는 서버에서 파일을 먼저 읽고, 업로드 전에 민감정보를 마스킹합니다.

업로드되는 것은 원본 파일이 아니라 마스킹된 scan JSON입니다.

```text
원본 파일
→ CLI가 로컬에서 스캔
→ 민감정보 마스킹
→ scan JSON 생성
→ 마스킹된 JSON만 업로드
```

S3 presigned URL은 로그와 에러 메시지에 그대로 노출되지 않도록 처리합니다.

---

## 12. 결과가 안 나오거나 스캔 대상이 없다고 뜰 때

대부분 실행 위치가 프로젝트 루트가 아닌 경우입니다.

```bash
pwd
ls
```

현재 폴더에 `.env`, `Dockerfile`, `docker-compose.yml` 같은 파일이 있는지 확인하세요.

다른 위치에서 실행한다면:

```bash
ssafer run --path <프로젝트 경로>
```

---

## 13. 삭제와 정리

SSAfer CLI를 삭제하려면 설치 방식에 맞는 명령을 사용합니다.

pip로 설치한 경우:

```bash
pip uninstall ssafer
```

pipx로 설치한 경우:

```bash
pipx uninstall ssafer
```

로컬 로그인 토큰과 Agent 설정을 지우려면:

```bash
ssafer logout
```

`pip uninstall ssafer` 또는 `pipx uninstall ssafer`는 CLI 패키지만 삭제합니다. `~/.ssafer`에 저장된 로그인 정보, scan 결과, server-audit 결과는 자동으로 삭제하지 않습니다.

로컬 SSAfer 데이터까지 직접 삭제하려면:

```bash
rm -rf ~/.ssafer
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force "$HOME\.ssafer"
```

### ssafer tools로 설치한 Trivy 삭제

`ssafer tools`는 현재 Trivy 설치를 도와줍니다.

Windows에서 winget으로 설치된 Trivy 삭제:

```powershell
winget uninstall --id AquaSecurity.Trivy -e
```

Ubuntu/Debian에서 apt로 설치된 Trivy 삭제:

```bash
sudo apt-get remove -y trivy
```

apt repository와 key까지 정리하려면:

```bash
sudo rm -f /etc/apt/sources.list.d/trivy.list
sudo rm -f /usr/share/keyrings/trivy.gpg
sudo apt-get update
```
