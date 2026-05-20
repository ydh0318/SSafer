# SSAfer 오픈소스 공개 준비 체크리스트

이 문서는 SSAfer 저장소를 MIT 라이선스로 공개하기 전에 확인해야 할 항목을 정리한 것이다.
법률 자문은 아니며, 공개 전 최종 책임 주체와 라이선스 문구는 팀/기관 기준으로 확정해야 한다.

## 현재 상태 요약

- 루트에 MIT `LICENSE` 파일을 추가했다.
- 루트 `README.md`에 Security, License 섹션을 추가했다.
- `CLI/pyproject.toml`, `Engine/pyproject.toml`에 Python 패키지 라이선스 메타데이터를 추가했다.
- `Backend/ssafer/pom.xml`의 `<licenses>`에 MIT License 정보를 추가했다.
- `Frontend/package.json`은 `"private": true`를 유지하되 license 필드에 `MIT`를 추가했다.
- 실제 `.env` 파일은 Git 추적 대상은 아니지만 저장소 작업 디렉터리에 존재할 수 있다.
- `.gitignore`는 `.env`, 키 파일, `.ssafer/`, `secrets/` 등을 제외하도록 되어 있다.
- `Infra/CLAUDE.md`가 Git 추적 대상이면 내부 운영 메모 성격인지 확인하고, 공개 전 제거 또는 정제가 필요하다.

## MIT 라이선스 적용 내용

### 1. 루트 `LICENSE` 추가

표준 MIT License 파일을 루트에 추가했다.

현재 적용 값:

```text
MIT License

Copyright (c) 2026 ssafer
```

나중에 확정이 필요한 값:

- 저작권 연도: `2026`
- 저작권자: `ssafer`

### 2. README에 라이선스 섹션 추가

루트 `README.md` 하단에 아래 섹션을 추가했다.

```md
## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
```

CLI만 별도 배포한다면 `CLI/README.md`에도 동일하게 명시한다.

### 3. 패키지 메타데이터에 license 추가

Python 패키지에는 아래 메타데이터를 추가했다.

```toml
[project]
license = "MIT"
```

대상:

- `CLI/pyproject.toml`: 완료
- `Engine/pyproject.toml`: 완료

Maven에는 아래 메타데이터를 추가했다.

```xml
<licenses>
  <license>
    <name>MIT License</name>
    <url>https://opensource.org/license/mit/</url>
    <distribution>repo</distribution>
  </license>
</licenses>
```

대상:

- `Backend/ssafer/pom.xml`: 완료

Frontend를 패키지로 배포하지 않고 앱으로만 공개한다면 `"private": true`는 유지해도 된다.
저장소 라이선스 표시 목적상 아래 필드를 추가했다.

```json
"license": "MIT"
```

## 의존성 라이선스 1차 판단

현재 매니페스트 기준으로 눈에 띄는 강한 copyleft 의존성은 보이지 않는다.
대부분 MIT, Apache-2.0, BSD, ISC 계열로 예상된다.

주요 의존성:

- Python CLI/Engine: `httpx`, `pydantic`, `pyyaml`, `rich`, `typer`, `websockets`, `fastapi`, `uvicorn`
- AI: `langchain`, `langchain-ollama`, `langchain-anthropic`, `langchain-openai`, `boto3`, `pika`, `aio-pika`
- Backend: Spring Boot, Spring Security, Flyway, AWS SDK, JJWT, PostgreSQL JDBC, Lombok, springdoc-openapi
- Frontend: React, Vite, Tailwind CSS, Axios, Framer Motion, Lucide, Zustand, Storybook, TypeScript, ESLint, Prettier

공개 전에는 자동 리포트를 한 번 남기는 것이 좋다.

권장 명령:

```bash
# Frontend
cd Frontend
npm install
npx license-checker --production --summary

# Python
cd CLI
pip install pip-licenses
pip-licenses --format=markdown

cd ../Engine
pip install pip-licenses
pip-licenses --format=markdown

# Maven
cd Backend/ssafer
mvn project-info-reports:dependencies
```

주의:

- GPL, AGPL, LGPL 의존성이 나오면 배포 방식에 따라 추가 검토가 필요하다.
- 개발 도구(dev dependency)는 제품 배포물에 포함되지 않더라도 저장소 공개 관점에서는 별도 표기하면 좋다.
- Trivy 같은 외부 실행 도구를 번들링하지 않고 사용자가 설치하게 하는 구조라면, README에 외부 도구 요구사항으로 명시한다.

## 민감정보 및 내부정보 점검

### 반드시 확인할 파일

- `AI/.env`
- `Backend/ssafer/.env`
- `Infra/CLAUDE.md`
- `Infra/docs/*`
- `Infra/n8n/workflows/*.json`
- `AI/data/*.json`
- 모든 `.env.example`, `.env.sample`

실제 `.env` 파일은 Git 추적 대상이 아니더라도, 공개 전 작업 디렉터리에서 삭제하거나 저장소 밖으로 옮기는 것이 안전하다.

점검 기준:

- 실제 API 키, 토큰, 패스워드, secret이 없어야 한다.
- 내부 도메인, 서버 IP, Jenkins/n8n 운영 경로가 공개되어도 되는 정보인지 확인한다.
- 예시 파일에는 실제처럼 보이는 키 형식을 피하고 `REPLACE`, `change_me`, `<YOUR_KEY>` 같은 placeholder만 둔다.
- 샘플 데이터에 실제 사용자, 프로젝트, 취약점 결과, 운영 로그가 섞이지 않았는지 확인한다.

권장 스캔:

```bash
git grep -n -I -E "(api[_-]?key|secret|password|passwd|token|access[_-]?key|private[_-]?key|AWS_ACCESS|AWS_SECRET|client_secret|DATABASE_URL|OPENAI|ANTHROPIC|GMS)"
```

추가로 `gitleaks` 또는 `trufflehog`로 Git 히스토리까지 검사하는 것을 권장한다.

## 공개 범위 결정

전체 저장소를 공개할지, CLI/Engine만 먼저 공개할지 결정해야 한다.

### 전체 공개

장점:

- 제품 구조와 데모가 한 번에 보인다.
- Backend, Frontend, AI, Infra까지 연결된 프로젝트로 설명하기 쉽다.

주의:

- Infra 문서와 운영 스크립트의 내부정보 정제가 필요하다.
- 배포용 compose, Jenkins, n8n 문서에 공개하면 안 되는 운영 힌트가 있을 수 있다.

### CLI/Engine 우선 공개

장점:

- 정적 분석 오픈소스라는 목적에 가장 잘 맞는다.
- 라이선스/민감정보 검토 범위가 작다.
- PyPI 배포와 README 정비가 빠르다.

주의:

- Backend/Frontend 연동 기능은 별도 SaaS 또는 데모로 설명해야 한다.
- `ssafer run --upload` 같은 명령은 공개 API 의존성을 문서화해야 한다.

추천:

- 빠르게 공개해야 하면 `CLI`와 `Engine` 중심으로 먼저 정리한다.
- 프로젝트 전체 포트폴리오 목적이면 전체 공개하되 Infra 문서를 먼저 정제한다.

## 공개 전 최소 작업 순서

1. 공개 범위를 결정한다.
2. 저작권자가 `ssafer`로 맞는지 최종 확인한다.
3. 실제 `.env` 파일을 작업 디렉터리에서 제거한다.
4. `Infra/CLAUDE.md`와 내부 운영 문서를 공개 가능한 내용으로 정리하거나 Git 추적에서 제거한다.
5. 의존성 라이선스 리포트를 생성하고 GPL/AGPL 계열이 없는지 확인한다.
6. secret scanner로 현재 파일과 Git 히스토리를 검사한다.
7. 공개 직전 clean clone에서 설치/실행 명령이 동작하는지 검증한다.

## README에 추가하면 좋은 섹션

```md
## Security

Please do not report security vulnerabilities through public GitHub issues.
Contact: <security contact>

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
```

보안 프로젝트이므로 취약점 제보 경로는 README 또는 `SECURITY.md`로 분리하는 것이 좋다.

## 결론

MIT 라이선스 적용 자체는 단순하다.
현재 저장소에서 더 중요한 남은 작업은 공개 범위와 내부정보 정제다.
특히 `Infra/CLAUDE.md`, 실제 `.env` 파일, 운영 문서, 예시 데이터, 배포 스크립트를 먼저 확인해야 한다.
