# SSAfer CLI 명령어 정리

## 주요 명령어

| 명령어 | 설명 |
| --- | --- |
| `ssafer doctor` | Python, Docker, Docker Compose, Trivy 환경을 점검한다. |
| `ssafer run --path <dir>` | 지정한 프로젝트를 스캔하고 `.ssafer/results`에 결과 JSON을 저장한다. |
| `ssafer report --path <dir>` | 마지막 스캔 결과 요약을 출력한다. |
| `ssafer report --path <dir> --details` | 마지막 스캔 결과의 상세 정보, 스캔 대상, findings, artifacts를 출력한다. |
| `ssafer upload --path <dir>` | 마지막 스캔 패키지를 백엔드 등록 후 S3 presigned URL로 업로드한다. |
| `ssafer login` | 업로드에 사용할 인증 토큰을 저장하고, 업로드 시 Bearer 헤더에 포함되도록 설정한다. |
| `ssafer logout` | 저장된 인증 토큰을 삭제한다. |
| `ssafer install-tools` | Trivy 설치를 안내하거나 Windows 환경에서 winget 기반 설치를 시도한다. |
| `ssafer version` | 현재 SSAfer CLI 버전을 출력한다. |

참고: 기존 `ssafer login --logout`도 호환성 목적으로 동작하지만, 사용자-facing 명령은 `ssafer logout`을 기준으로 사용한다.

## 생성되는 주요 파일

`ssafer run --path <dir>` 실행 후 프로젝트 루트 아래에 `.ssafer` 디렉터리가 생성된다.

| 경로 | 설명 |
| --- | --- |
| `.ssafer/results/{scanId}.json` | 최종 스캔 결과 JSON |
| `.ssafer/results/last_scan.txt` | 마지막 스캔 결과 파일명 |
| `.ssafer/trivy/*.json` | Trivy 원본 JSON 결과 |
| `.ssafer/effective/sanitized/*.compose.yml` | 마스킹된 effective Compose YAML |
| `.ssafer/effective/raw/*.compose.yml` | `--save-raw` 사용 시 저장되는 원본 effective Compose YAML |

## 업로드 인증

업로드 토큰은 아래 우선순위로 사용된다.

1. 환경변수 `SSAFER_TOKEN`
2. `ssafer login`으로 저장한 `~/.ssafer/config.yml`의 토큰

토큰이 있으면 백엔드 scan 등록 요청과 업로드 완료 알림 요청에 `Authorization: Bearer <token>` 헤더가 포함된다.
S3 presigned URL `PUT` 요청에는 별도 Authorization 헤더를 붙이지 않는다.

업로드 흐름:

1. `POST /api/v1/scans`로 scan 등록
2. 응답의 `rawUploadUrl`로 scan JSON을 S3에 `PUT`
3. `POST /api/v1/internal/scans/{scanId}/raw-results`로 업로드 완료 알림

