# SSafer - 설명형 보안 코파일럿

> 당신의 코드가 세상에 안전하게 닿도록, SSafer

배포 전 보안 설정을 자동 점검하고, 위험 원인과 해결 방법을 설명하며, 승인 기반으로 실제 수정까지 연결하는 보안 자동화 코파일럿

---

## 프로젝트 구조

```text
S14P31B105/
├── CLI/         # Typer 기반 SSAfer CLI
├── AI/          # LLM 분석 파이프라인
├── Backend/     # FastAPI 기반 API 서버
├── Frontend/    # React + TypeScript 대시보드
├── Infra/       # Docker, EC2, 배포 설정
└── docs/        # 기획서, 컨벤션, 프로젝트 문서
```

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Backend | Spring Boot, PostgreSQL, RabbitMQ |
| Frontend | React, TypeScript |
| AI | FastAPI, LangChain Agent, Ollama/GMS, NVD/HasData |
| Infra | GitLab CI/CD, Docker, Jenkins, n8n |

## 주요 기능

- EC2 + Docker 환경 보안 점검 (포트, 이미지, 설정, Secret 등)
- Custom Rule과 Trivy 결과를 공통 `findings[]` 스키마로 정규화
- CLI scan JSON을 백엔드 등록 후 S3 presigned URL로 업로드
- AI 기반 위험 원인 및 해결 방법 자연어 설명
- 수정 제안 및 승인 기반 자동 적용
- 보안 상태 이력 관리 및 대시보드 시각화

---

## SSAfer CLI 빠른 시작

SSAfer CLI는 로컬 프로젝트 또는 EC2 서버 환경을 점검하고, 결과를 웹에서 확인할 수 있게 업로드하는 도구입니다.

### 1. CLI 설치

```bash
pip install ssafer
```

### 2. 로그인

```bash
ssafer login
```

### 3. 로컬 프로젝트 스캔

점검할 코드가 있는 파일 경로에서 실행합니다.
프로젝트 루트에서 실행할 경우, 파일 전체를 점검합니다.

```bash
cd <파일 경로> 또는 <프로젝트 루트>
ssafer tools
ssafer run --upload
```

업로드가 완료되면 터미널에 출력되는 scan URL에서 결과를 확인할 수 있습니다.

### 4. 서버 런타임 점검

EC2 같은 서버 환경에서 스캔 및 업로드를 하는 명령어입니다.

서버 환경에서는 가상 환경을 만들어 'pip install ssafer' 를 한 후, 해당 환경에서 실행할 것을 권장합니다.<br>
ex)<br>
`python3 -m venv ~/.ssafer-venv`<br>
`source ~/.ssafer-venv/bin/activate`

```bash
ssafer server --upload
```

서버 점검은 열린 포트, Docker 상태, SSH, 방화벽 등 실행 중인 서버 환경을 확인합니다.

### 5. 웹에서 Local Agent 사용

웹에서 스캔 또는 수정 요청을 보내려면, 점검할 PC 또는 서버에서 Local Agent를 실행해야 합니다.

지정한 파일 경로 기준으로 agent를 실행합니다.

```bash
cd <파일 경로>
ssafer agent

혹은

ssafer login 시 agent 실행도 동시에 가능
```

Agent가 연결된 상태에서 웹의 Agent 스캔 버튼을 누르면 스캔과 업로드가 한 번에 진행됩니다.

### 6. 수정안 적용

AI 분석 결과에 자동 적용 가능한 패치가 있는 경우 CLI에서 직접 적용할 수 있습니다.

```bash
ssafer apply
```

더 자세한 CLI 명령어, 옵션, 삭제/초기화 방법은 [CLI/README.md](./CLI/README.md)를 참고하세요.
