# Agent Graph 구축

이 문서는 finding 분석 정확도를 높이기 위해 도구로 컨텍스트를 보강하는 에이전트 그래프와, 에이전트가 사용하는 도구 3종을 정리합니다.

## 1. 목적

심각하거나 CVE가 걸린 finding은 finding 텍스트만으로는 설명/수정이 부정확할 수 있습니다. 에이전트는 도구를 호출해 **CVE 상세, 코드 컨텍스트, 웹 참고자료**를 모은 뒤, 그 결과(`enriched_context`)를 Explain/Fix 프롬프트의 추가 입력으로 넣습니다.

에이전트는 최종 설명이나 수정 제안을 직접 쓰지 않습니다. 컨텍스트만 수집하고, 작성은 Explain/Fix Chain이 담당합니다.

## 2. 활성화 조건

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AGENT_ENABLED` | `false` | 에이전트 보강 단계 on/off |
| `AGENT_MAX_ITERATIONS` | `3` | 에이전트 최대 반복 횟수 |

`AGENT_ENABLED=true`이고 `should_use_agent(finding)`가 참인 finding만 에이전트 경로로 갑니다.

```text
should_use_agent 트리거 (둘 중 하나):
1) ruleId/title/maskedEvidence에 CVE-YYYY-NNNN 식별자가 있음
2) severity가 HIGH 또는 CRITICAL
```

LOW/MEDIUM의 단순 misconfig는 에이전트 없이 배치 경로로 빠르게 처리합니다.

## 3. 구현 위치

```text
app/chains/agent_chain.py      그래프 생성
app/services/agent_service.py  실행 + enriched_context 변환
app/prompts/agent_prompt.py    system/user 프롬프트
app/tools/cve_tool.py          search_cve
app/tools/code_context_tool.py analyze_code_context
app/tools/web_search_tool.py   search_web
```

## 4. 그래프 구성

LangChain 1.x `create_agent()`로 만드는 tool-calling 에이전트입니다(LangGraph `CompiledStateGraph`).

```python
build_agent()  # app/chains/agent_chain.py
# create_agent(model=get_llm(), tools=DEFAULT_TOOLS, system_prompt=AGENT_SYSTEM_PROMPT)
# DEFAULT_TOOLS = [search_cve, analyze_code_context, search_web]
```

system 프롬프트는 "도구로 컨텍스트만 수집하고 최종 답은 쓰지 말 것", "도구 호출 전 한국어로 짧게 이유를 적을 것", "같은 도구를 같은 인자로 중복 호출 금지", "충분하면 멈출 것"을 지시합니다.

## 5. 실행 흐름

```python
run_agent_for_finding(finding, scan_result) -> dict  # enriched_context
```

```text
AGENT_ENABLED=false → 빈 dict 반환
scan_result를 contextvar에 등록 (analyze_code_context가 artifacts를 읽기 위함)
agent.invoke({"messages": [user]},
             config={"recursion_limit": AGENT_MAX_ITERATIONS * 3})
→ messages에서 tool 호출/결과/요약을 enriched_context로 변환
실행 중 예외 발생 → 빈 dict 반환 (fail-open)
```

fail-open이므로 도구나 에이전트가 실패해도 분석 파이프라인은 중단되지 않고, 보강 없이 기본 분석을 진행합니다.

## 6. 도구 3종

### 6-1. search_cve (NVD CVE 조회)

```python
search_cve(cve_id: str) -> dict
```

NIST NVD API v2.0에서 CVE 상세를 조회합니다. CVE 형식(`CVE-YYYY-NNNN+`)이 아니면 조회하지 않습니다. 결과는 LRU 캐시(`NVD_CACHE_MAX_SIZE`)에 보관합니다.

```json
{
  "available": true,
  "cve_id": "CVE-2024-21626",
  "cvss_score": 8.6,
  "severity": "HIGH",
  "description": "영문 설명 (최대 400자)",
  "published": "...",
  "last_modified": "...",
  "references": [{ "url": "...", "tags": ["..."] }]
}
```

관련 설정: `NVD_API_KEY`, `NVD_API_ENDPOINT`, `NVD_TIMEOUT_SECONDS`, `NVD_CACHE_MAX_SIZE` (`05_configuration.md` 9절).

### 6-2. analyze_code_context (코드 컨텍스트)

```python
analyze_code_context(target: str, line: int = 0, context_lines: int = 10) -> dict
```

외부 호출 없이 현재 `scan_result.artifacts[].content`에서 해당 파일의 코드 일부를 읽습니다. `line=0`이면 파일 앞부분(최대 40줄)을 미리보기로, 그 외에는 해당 라인 기준 위·아래 `context_lines`줄(최대 50)을 반환합니다.

```json
{
  "available": true,
  "target": "Dockerfile",
  "snippet": "...",
  "line_range": [1, 21],
  "total_lines": 42,
  "mode": "centered"
}
```

`scan_result`에 artifact가 없거나 컨텍스트가 등록되지 않으면 `available: false`를 반환합니다.

### 6-3. search_web (웹 검색)

```python
search_web(query: str, max_results: int = 3) -> list[dict]
```

HasData SERP API로 일반 보안 모범사례/가이드를 검색합니다. CVE 조회는 `search_cve`를 씁니다.

```json
[
  { "title": "...", "url": "https://...", "snippet": "... (최대 300자)" }
]
```

`HASDATA_ENABLED=false`이거나 `HASDATA_API_KEY`가 없으면 빈 배열을 반환합니다. 관련 설정은 `05_configuration.md` 10절.

> 같은 HasData SERP API는 에이전트와 별개로, 분석 파이프라인의 REFERENCE 단계(`reference_service`)에서도 모든 finding에 대해 항상 호출됩니다. 그 결과는 `analysis_result.json`의 `references` 필드로 저장됩니다(`07_analysis_result_output.md`). 즉 에이전트가 꺼져 있어도 참고자료 조회는 동작합니다.

## 7. 출력: enriched_context

`run_agent_for_finding()`은 에이전트 messages를 아래 구조로 변환합니다.

```python
{
  "tool_calls": [{"tool": str, "args": dict, "result": Any}],
  "cve_info": dict,        # search_cve 성공 시
  "code_context": dict,    # analyze_code_context 성공 시
  "web_refs": list[dict],  # search_web 결과 (최대 5)
  "agent_summary": str,    # 마지막 AI 메시지 요약
  "reasoning_steps": list[dict],  # ReAct 스타일 단계 (step/thought/action/actionInput/observation/final)
}
```

`reasoning_steps`는 사용자에게 보여줄 단계별 추론 트레이스로, AIMessage(도구 호출)와 직후 ToolMessage(결과)를 묶어 구성합니다.

## 8. Explain/Fix 입력 연결

`format_enriched_context_for_prompt(enriched)`가 `enriched_context`를 한 덩어리 텍스트로 만들어 finding 입력 뒤에 덧붙입니다. Explain/Fix 프롬프트는 이 컨텍스트를 "정확도용 참고자료(추측 금지)"로 사용합니다.

```text
finding_input
+ "Additional research context from agent tools (use for accuracy, do not invent):"
  - CVE: id=... cvss=... severity=...
  - Code context (target lines [..]): ...
  - Web refs (top N): [...]
  - Agent summary: ...
```

## 9. 확인

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_agent_service tests.test_cve_tool tests.test_code_context_tool tests.test_web_search_tool
```

에이전트가 실제 도구를 호출하려면 `AGENT_ENABLED=true`로 설정하고, CVE 조회/웹 검색은 각각 NVD·HasData 설정이 필요합니다.
