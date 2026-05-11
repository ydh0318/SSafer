# Fix Chain 구축

이 문서는 보안 finding에 대한 수정 제안 생성 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
수정 제안 생성 프롬프트 정의
JSON 출력 형식 고정
LangChain Fix Chain 구현
finding 기반 수정 제안 생성 로직 구현
JSON 응답 파싱 및 스키마 검증
파싱 또는 스키마 실패 시 실패 사유를 포함한 재시도 지시문 적용
```

## 2. 프롬프트 파일

수정 제안 생성 프롬프트는 아래 파일에 정의되어 있습니다.

```text
app/prompts/fix_prompt.py
```

## 3. 프롬프트 목적

Fix 프롬프트는 하나의 finding 입력을 받아 개발자가 바로 작업 방향을 잡을 수 있는 수정 제안을 생성하기 위해 사용합니다.

작성 기준:

```text
기본 자연어는 한국어로 작성
JSON 객체 하나만 반환
지정된 key 외 추가 key 출력 금지
finding에 있는 파일, 줄 번호, 근거, 심각도 기준으로 제안
finding에 없는 파일 구조, 패키지명, 함수명, 설정 키, 배포 환경 단정 금지
비밀 값 또는 민감한 값 추측 및 복원 금지
비밀 값을 코드, 설정 파일, 저장소에 다시 적으라는 제안 금지
실행 명령어, 공격 절차, 악용 코드 출력 금지
```

## 4. 입력 변수

프롬프트는 아래 변수를 받습니다.

```text
finding_input
```

`finding_input`은 `app/services/input_service.py`에서 변환한 finding 텍스트입니다.

## 5. 출력 형식

LLM 응답은 반드시 아래 JSON 객체 하나여야 합니다.

```json
{
  "summary": "수정 방향을 한 문장으로 요약",
  "priority": "high",
  "recommendedActions": [
    "개발자가 수행할 구체적인 수정 작업 1",
    "개발자가 수행할 구체적인 수정 작업 2"
  ],
  "codeGuidance": "코드나 설정을 어떻게 바꾸면 되는지 설명",
  "verification": "수정 후 확인해야 할 방법",
  "cautions": [
    "수정할 때 주의할 점"
  ],
  "patches": [
    {
      "patchId": "PATCH-0001",
      "targetFile": "Dockerfile",
      "operation": "replace",
      "oldText": "USER root",
      "newText": "USER appuser",
      "expectedFileHash": "sha256:...",
      "requiresApproval": true,
      "rollback": {
        "operation": "replace",
        "oldText": "USER appuser",
        "newText": "USER root"
      }
    }
  ]
}
```

필드별 제약:

```text
summary: 한 문장, 80자 이내
priority: high, medium, low 중 하나
recommendedActions: 2~5개의 문자열 배열
codeGuidance: 코드 예시 대신 변경 방향을 1~3문장으로 설명
verification: 수정 후 확인 방법을 1~2문장으로 설명
cautions: 1~3개의 문자열 배열
patches: 선택 필드, CLI가 안전하게 replace 적용할 수 있을 때만 작성
patches[].targetFile: 저장소 루트 기준 상대 경로
patches[].operation: 현재 replace만 허용
patches[].requiresApproval: 항상 true
```

`patches`는 정확한 `targetFile`, `oldText`, `newText`를 알 수 있을 때만 생성합니다.
대상 파일 경로나 정확한 원문 조각을 알 수 없거나, 마스킹된 민감 값만 있는 경우에는 `patches` key를 생략하고 설명형 `fix`만 반환합니다.

## 6. Fix Chain 구현

Fix Chain은 아래 파일에 정의되어 있습니다.

```text
app/chains/fix_chain.py
```

구성:

```text
FIX_PROMPT
→ ChatOllama(format="json")
→ StrOutputParser
```

## 7. 수정 제안 생성 서비스

수정 제안 생성 서비스는 아래 파일에 있습니다.

```text
app/services/fix_service.py
```

주요 함수:

```python
generate_finding_fix(finding: dict) -> dict
generate_finding_fixes(findings: list[dict]) -> list[dict]
parse_fix_response(response: str) -> dict
build_fix_retry_prompt(finding_input: str, error_message: str) -> str
```

처리 흐름:

```text
finding dict
→ format_finding_for_llm()
→ create_fix_chain()
→ chain.invoke({"finding_input": ...})
→ JSON 문자열 정규화
→ JSON 파싱
→ 필수 필드 및 타입 검증
→ 실패 시 실패 사유를 저장
→ 실패 사유와 제약 조건을 포함해 재시도
→ fix dict 반환
```

재시도는 최대 2회 수행합니다.

재시도 프롬프트에는 아래 내용이 포함됩니다.

```text
이전 실패 사유
JSON 객체 하나만 반환
JSON 객체 밖 문자 금지
6개 key 고정
priority 허용값
recommendedActions, cautions 배열 길이
한국어 자연어 작성
금지 문자 사용 금지
```

모든 재시도가 실패하면 마지막 실패 사유를 포함한 `ValueError`를 발생시킵니다.

## 8. 검증 확인

아래 명령어로 Fix 프롬프트가 정상 렌더링되는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.prompts.fix_prompt import FIX_PROMPT; messages = FIX_PROMPT.format_messages(finding_input='탐지 ID: FND-0001'); print(len(messages)); print(messages[0].type, messages[1].type)"
```

정상 출력 예시:

```text
2
system human
```

실제 LLM 출력 테스트는 Ollama 서버 실행 후 아래 명령어로 확인할 수 있습니다.

```bash
python scripts/test_fix_chain.py
```
