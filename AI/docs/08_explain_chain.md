# Explain Chain 구축

이 문서는 보안 finding에 대한 설명 생성 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
보안 설명 생성 프롬프트 정의
LangChain Explain Chain 구현
finding 기반 설명 생성 로직 구현
설명 결과 출력 테스트
```

## 2. 프롬프트 파일

보안 설명 생성 프롬프트는 아래 파일에 정의되어 있습니다.

```text
app/prompts/explain_prompt.py
```

## 3. 프롬프트 목적

Explain 프롬프트는 하나의 finding 입력을 받아 바이브코더 또는 보안 초보 개발자가 이해할 수 있는 보안 설명을 생성하기 위해 사용합니다.

설명 범위:

```text
취약점이 의미하는 것
위험한 이유
악용 가능 시나리오
서비스나 운영 환경에 줄 수 있는 영향
심각도 해석
```

작성 기준:

```text
쉬운 말과 짧은 문장 사용
전문 용어는 쉬운 뜻을 함께 설명
불필요한 영어 표현 사용 금지
과장된 표현 금지
finding에 있는 정보 기준으로 설명
finding에 없는 파일 구조, 코드 흐름, 프레임워크, 공격 성공 여부 단정 금지
비밀 값 또는 민감한 값 추측 및 복원 금지
코드 예시, 설정 예시, 명령어, 표, 코드 블록 출력 금지
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

LLM 응답은 한국어로 생성하며 아래 5개 섹션만 포함하도록 요청합니다.

```text
1. 취약점 요약
2. 위험한 이유
3. 악용 가능 시나리오
4. 예상 영향
5. 심각도 해석
```

섹션별 제약:

```text
섹션 이름과 순서 고정
각 섹션은 2~3문장 중심으로 짧게 작성
각 문장은 80자 이내로 작성
앞뒤 인사말 또는 추가 요약 출력 금지
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
아래 보안 finding을 설명하세요.
```

## 7. Explain Chain 구현

Explain Chain은 아래 파일에 정의되어 있습니다.

```text
app/chains/explain_chain.py
```

현재 구현된 함수:

```python
create_explain_chain()
```

구성:

```text
EXPLAIN_PROMPT
→ ChatOllama
→ StrOutputParser
```

즉, 프롬프트에 `finding_input`을 넣으면 Ollama 모델이 설명을 생성하고, 최종 결과를 문자열로 반환하는 구조입니다.

## 8. Chain 생성 확인

아래 명령어로 Explain Chain이 정상 생성되는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.chains.explain_chain import create_explain_chain; chain = create_explain_chain(); print(type(chain).__name__); print(chain.input_schema.model_json_schema().get('properties', {}).keys())"
```

정상 출력 예시:

```text
RunnableSequence
dict_keys(['finding_input'])
```

## 9. Finding 기반 설명 생성 로직

검증된 finding을 Explain Chain에 전달해 설명을 생성하는 서비스는 아래 파일에 있습니다.

```text
app/services/explain_service.py
```

현재 구현된 함수:

```python
generate_finding_explanation(finding: dict) -> str
generate_findings_explanation_batch(findings: list[dict]) -> dict[str, dict]
```

처리 흐름:

```text
finding dict
→ format_finding_for_llm()
→ create_explain_chain()
→ chain.invoke({"finding_input": ...})
→ 금지 문자 검사
→ 필요 시 제약 조건을 강화해 재시도
→ explanation 문자열 반환
```

여러 finding을 한 번에 처리할 때는 `generate_findings_explanation_batch()`가 finding `id`별로 설명을 묶어서 반환합니다.

## 10. 로직 import 확인

아래 명령어로 설명 생성 서비스가 정상 import되는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.services.explain_service import generate_finding_explanation, generate_findings_explanation_batch; print(generate_finding_explanation.__name__, generate_findings_explanation_batch.__name__)"
```

정상 출력 예시:

```text
generate_finding_explanation generate_findings_explanation_batch
```

## 11. 설명 결과 출력 테스트

Explain Chain 출력 테스트 스크립트는 아래 파일에 있습니다.

```text
scripts/test_explain_chain.py
```

테스트 흐름:

```text
data/scan_result.json 로딩
→ findings 추출
→ 필수 필드 검증
→ 첫 번째 finding 선택
→ Explain Chain 호출
→ 설명 결과 출력
```

먼저 Ollama 서버를 실행합니다.

```bash
ollama serve
```

다른 터미널에서 테스트 스크립트를 실행합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python scripts/test_explain_chain.py
```

정상 실행 시 아래와 같이 finding ID와 설명 결과가 출력됩니다.

```text
Finding ID: FND-0001
1. 취약점 요약
...
```

현재 기본 모델인 `qwen2.5:3b`는 로컬 모델이므로 일부 표현 품질이 불안정할 수 있습니다.