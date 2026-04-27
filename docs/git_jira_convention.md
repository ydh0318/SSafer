# Git / Jira Convention

SSafer 프로젝트에서 Jira 이슈, 브랜치, 커밋, MR을 연결해서 관리하기 위한 컨벤션입니다.

## Jira 이슈

### 이슈 키

Jira 이슈 키는 `S14P31B105-번호` 형식을 사용합니다.

예시:

```text
S14P31B105-23
```

### 이슈 제목

작업 내용을 짧고 명확하게 작성합니다.

예시:

```text
프로젝트 초기세팅
CLI 스캔 결과 저장 기능 구현
로그인 API 구현
대시보드 취약점 목록 UI 구현
```

### 이슈 타입

```text
Story: 사용자 관점의 기능 단위
Task: 개발 작업 단위
Bug: 버그 수정
Sub-task: 상위 이슈를 나눈 세부 작업
```

## 브랜치 컨벤션

### 형식

```text
영역/타입/Jira이슈키/작업-요약
```

### 영역

```text
COMMON
FRONTEND
BACKEND
AI
INFRA
CLI
```

### 타입

```text
feat
fix
refactor
docs
test
chore
style
ci
```

### 예시

```text
COMMON/feat/S14P31B105-23/프로젝트-초기세팅
CLI/feat/S14P31B105-31/스캔-결과-저장
BACKEND/fix/S14P31B105-42/로그인-예외처리
FRONTEND/docs/S14P31B105-55/README-수정
INFRA/chore/S14P31B105-60/nginx-설정-추가
```

## 커밋 컨벤션

### 형식

```text
타입: [영역] 작업 내용
```

### 타입

```text
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 동작 변경 없는 구조 개선
docs: 문서 수정
test: 테스트 추가 또는 수정
chore: 설정, 빌드, 패키지 등 기타 작업
style: 포맷팅, 세미콜론 등 코드 의미 변경 없는 수정
ci: CI/CD 설정 수정
```

### 영역

```text
[공통]
[프론트엔드]
[백엔드]
[AI]
[인프라]
[CLI]
```

### 예시

```text
feat: [공통] 프로젝트 초기세팅
feat: [CLI] Docker Compose 스캔 기능 구현
fix: [백엔드] 로그인 실패 응답 코드 수정
docs: [CLI] 사용 방법 문서 추가
test: [CLI] 환경 변수 마스킹 테스트 추가
chore: [인프라] Docker 설정 정리
```

### 커밋 작성 규칙

- 커밋 제목은 50자 내외로 짧게 작성합니다.
- 한 커밋에는 하나의 논리적 변경만 담습니다.
- Jira 이슈와 연결이 필요하면 MR 또는 커밋 본문에 이슈 키를 포함합니다.
- 임시 커밋 메시지(`update`, `fix`, `asdf`)는 MR 전 정리합니다.

## MR 컨벤션

### 대상 브랜치

기본 대상 브랜치는 `develop`입니다.

```text
feature branch -> develop
develop -> master
```

### MR 제목

```text
[영역] 작업 내용
```

예시:

```text
[CLI] 스캔 결과 저장 기능 구현
[백엔드] 로그인 API 구현
[프론트엔드] 취약점 목록 UI 구현
```

### MR 본문 템플릿

아래 내용을 복사해서 사용합니다.

````markdown
## PR 요약
> 변경 사항을 한 문장으로 요약해주세요.

---

## 변경 내용
- [ ] 주요 기능 변경
- [ ] 버그 수정
- [ ] 리팩토링
- [ ] 문서 수정
- [ ] 기타

### 상세 설명
> 무엇을 변경했고 왜 변경했는지 설명해주세요.

---

## 테스트
- [ ] 로컬 테스트 완료
- [ ] 빌드 확인
- [ ] 관련 기능 수동 확인

### 테스트 결과
```text
테스트 명령 또는 확인 결과를 작성해주세요.
```

---

## To Reviewer
> 리뷰어가 특히 확인해야 할 부분이 있다면 작성해주세요.

---

## 관련 이슈
Close #이슈번호
Jira: S14P31B105-번호
````

## 작업 흐름

### 1. develop 최신화

```powershell
git checkout develop
git pull origin develop
```

### 2. 브랜치 생성

```powershell
git checkout -b CLI/feat/S14P31B105-31/스캔-결과-저장
```

### 3. 작업 후 상태 확인

```powershell
git status
git diff
```

### 4. 커밋

```powershell
git add CLI
git commit -m "feat: [CLI] 스캔 결과 저장 기능 구현"
```

### 5. 푸시

```powershell
git push origin CLI/feat/S14P31B105-31/스캔-결과-저장
```

### 6. MR 생성

GitLab에서 `develop` 브랜치 대상으로 MR을 생성합니다.

## CLI 작업 예시

### Jira

```text
S14P31B105-31 CLI 스캔 결과 저장 기능 구현
```

### Branch

```text
CLI/feat/S14P31B105-31/스캔-결과-저장
```

### Commit

```text
feat: [CLI] 스캔 결과 저장 기능 구현
```

### MR Title

```text
[CLI] 스캔 결과 저장 기능 구현
```
