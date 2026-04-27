# Explain Chain 구축

이 문서는 보안 finding에 대한 설명 생성 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
보안 설명 생성 프롬프트 정의
```

## 2. 프롬프트 파일

보안 설명 생성 프롬프트는 아래 파일에 정의되어 있습니다.

```text
app/prompts/explain_prompt.py
```

## 3. 프롬프트 목적

Explain 프롬프트는 하나의 finding 입력을 받아 개발자가 이해할 수 있는 보안 설명을 생성하기 위해 사용합니다.

설명 범위:

```text
취약점이 의미하는 것
위험한 이유
악용 가능 시나리오
서비스나 운영 환경에 줄 수 있는 영향
심각도 해석
```

수정 방법은 Fix Chain에서 별도로 처리할 예정이므로, Explain 프롬프트에서는 자세한 remediation을 생성하지 않도록 제한합니다.

## 4. 입력 변수

프롬프트는 아래 변수를 받습니다.

```text
finding_input
```

`finding_input`은 `app/services/input_service.py`에서 변환한 finding 텍스트입니다.

예시:

```text
Finding ID: FND-0001
Rule ID: ENV_PLAIN_SECRET
Source: custom-rule
Severity: HIGH
File: .env
Line: 1
Title: 환경변수 파일에 시크릿이 하드코딩됨: DB_PASSWORD
Evidence:
DB_PASSWORD=***MASKED***
```

## 5. 출력 형식

LLM 응답은 한국어로 생성하며 아래 섹션을 포함하도록 요청합니다.

```text
1. 취약점 요약
2. 위험한 이유
3. 악용 가능 시나리오
4. 예상 영향
5. 심각도 해석
```

## 6. 프롬프트 렌더링 확인

아래 명령어로 프롬프트가 정상 생성되는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.prompts.explain_prompt import EXPLAIN_PROMPT; messages = EXPLAIN_PROMPT.format_messages(finding_input='Finding ID: FND-0001\nSeverity: HIGH'); print(len(messages)); print(messages[0].type); print(messages[1].content.splitlines()[0])"
```

정상 출력 예시:

```text
2
system
Analyze the following security finding.
```
