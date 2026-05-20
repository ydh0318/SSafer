# Verify Chain 구축

이 문서는 생성된 수정 제안(fix)이 finding을 실제로 해결하는지 검증하고, 필요하면 재생성하는 흐름을 정리합니다.

## 1. 목적

Fix Chain(`09_fix_chain.md`)이 만든 `fix`가 finding과 동떨어지거나(다른 CVE를 설명, 일반론, 무관한 patch) 위험한 경우를 걸러냅니다. 검증에 실패하면 실패 사유를 피드백으로 넣어 fix를 다시 생성합니다.

분석 파이프라인에서 VERIFY 단계는 FIX 직후에 실행됩니다(`00_architecture_overview.md` 6절).

## 2. 활성화 조건

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VERIFY_ENABLED` | `false` | 검증/재생성 단계 전체 on/off |
| `VERIFY_LLM_ENABLED` | `true` | LLM 기반 검증 사용 여부 |
| `MAX_VERIFY_RETRIES` | `1` | 검증 실패 시 fix 재생성 최대 횟수 |

`VERIFY_ENABLED=false`이면 검증을 건너뛰고 fix를 그대로 통과시킵니다(`stage="skipped"`).

## 3. 구현 위치

```text
app/services/verify_service.py
app/chains/verify_chain.py
app/prompts/verify_prompt.py
```

주요 함수:

```python
verify_and_maybe_regenerate(finding: dict, fix: dict) -> tuple[dict, VerifyResult]
verify_once(finding: dict, fix: dict) -> VerifyResult
rule_based_verify(finding: dict, fix: dict) -> VerifyResult
should_run_llm_verify(finding: dict, fix: dict) -> bool
llm_verify(finding: dict, fix: dict) -> VerifyResult
```

## 4. 2단계 검증

`verify_once()`는 룰 기반 → (조건부) LLM 기반 순서로 검증합니다.

```text
rule_based_verify(finding, fix)
├─ 실패 → 즉시 실패 반환 (LLM 검증 생략)
└─ 통과
   └─ should_run_llm_verify()?
      ├─ 예 → llm_verify(finding, fix)
      └─ 아니오 → 룰 기반 통과 결과 반환
```

## 5. 룰 기반 검증

LLM 호출 없이 빠르게 명백한 불일치를 잡습니다.

```text
CVE 불일치: finding(ruleId/title)에 CVE가 있는데 fix가 다른 CVE만 언급하면 실패
server-audit 위반: SERVER_AUDIT finding인데 patches/patch가 있으면 실패
                   (운영 가이드는 코드 patch가 아니라 operational guidance만 제공)
```

실패 예시 사유:

```text
fix가 finding과 다른 CVE를 언급함. finding: ['CVE-2024-21626'], fix: ['CVE-2023-1234']
server-audit finding은 patches 없이 operational guidance만 제공해야 함.
```

## 6. LLM 기반 검증

`should_run_llm_verify()`가 모두 만족할 때만 실행합니다.

```text
VERIFY_LLM_ENABLED = true
finding.severity 가 HIGH 또는 CRITICAL
fix 에 patches 가 있음
```

검증 체인은 `VERIFY_PROMPT`에 finding과 fix(JSON)를 넣어 아래 JSON 하나를 요구합니다.

```json
{
  "passed": true,
  "reason": "간단한 한국어 사유 (passed=true여도 한 줄 요약)"
}
```

판단 기준:

```text
passed=true : fix가 finding과 동일한 취약점을 다루고, recommendedActions가 구체적이며,
              codeGuidance가 finding의 file/evidence/ruleId에 부합
passed=false: 다른 CVE/취약점을 다루거나, 동작이 비현실적이거나,
              recommendedActions가 일반론에 그치거나, patch가 finding과 무관
```

체인 구성:

```text
VERIFY_PROMPT
→ ChatModel(response_format="json", max_tokens=LLM_VERIFY_MAX_TOKENS)
```

응답 파싱이 실패하면 검증을 막지 않고 통과 처리합니다(`stage="llm_parse_failed"`, fail-open). 검증 오류로 정상 fix가 버려지는 것을 막기 위함입니다.

## 7. 재생성 루프

`verify_and_maybe_regenerate()`는 검증 실패 시 `MAX_VERIFY_RETRIES`회까지 재생성합니다.

```text
verify_once 실패
→ build_fix_retry_prompt(finding_input, 실패 사유)로 Fix Chain 재호출
→ SERVER_AUDIT면 patches 제거(postprocess)
→ verify_once 다시 실행
   ├─ 통과 → 새 fix 반환
   └─ 재시도 소진 → 마지막 fix와 실패 결과 반환
재생성 중 예외 발생 → 원래 fix 유지하고 실패 결과 반환
```

## 8. 검증 결과 (VerifyResult)

```python
@dataclass(frozen=True)
class VerifyResult:
    passed: bool
    stage: str        # skipped | rule | llm | llm_parse_failed
    retries: int = 0  # fix 재생성 횟수
    reason: str | None = None
```

이 결과는 `result_service.build_structured_analysis_result()`에서 분석 결과 항목 조립에 사용됩니다.

## 9. 확인

검증 단위 테스트로 룰/LLM/재생성 동작을 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_verify_service
```
