# 아키텍처 개요

이 문서는 AI 모듈의 전체 구조와 분석 요청이 처리되는 흐름을 한눈에 정리합니다. 개별 컴포넌트 상세는 각 문서를 함께 참고합니다.

## 1. AI 모듈이 하는 일

CLI/스캐너가 만든 `scan_result.json`을 입력받아, finding마다 LLM 기반 **설명(explain)** 과 **수정 제안(fix)** 을 생성하고, **검증(verify)**을 거쳐 `analysis_result.json`으로 저장합니다.

```text
scan_result.json (finding별 보안 취약점)
        ↓  AI 분석 파이프라인
analysis_result.json (finding별 설명 + 수정 제안)
```

## 2. 컴포넌트 구성

| 컴포넌트 | 역할 | 관련 문서 |
| --- | --- | --- |
| FastAPI | `/analyze` 엔드포인트 제공, 분석 파이프라인 실행 | `12_analyze_api.md` |
| Worker | RabbitMQ 메시지 consume, FastAPI 호출, Spring 콜백 | `13_spring_fastapi_interface.md` |
| RabbitMQ | Spring이 발행한 분석 작업 메시지 전달 | `13_spring_fastapi_interface.md` |
| Spring Boot | scan/task 상태 기준 저장소, 작업 발행, 콜백 수신 | `13_spring_fastapi_interface.md` |
| S3 | `scan_result.json` 입력, `analysis_result.json` 출력 저장소 | `04_s3_setup.md` |
| LLM provider | Ollama(로컬) / GMS / Anthropic 중 선택 | `03_langchain_setup.md`, `15_external_model_comparison.md` |

FastAPI와 Worker는 같은 `AI/` 코드베이스를 공유하지만 **별도 프로세스**로 실행합니다.

## 3. 실행 단위

| 실행 단위 | 명령 | 진입점 |
| --- | --- | --- |
| FastAPI | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | `app/main.py` |
| Worker | `python -m app.worker.async_consumer` | `app/worker/async_consumer.py` |

## 4. End-to-End 처리 흐름 (운영)

운영에서는 Spring이 FastAPI를 직접 호출하지 않고, Worker가 RabbitMQ 메시지를 받아 FastAPI를 호출합니다.

```text
CLI → S3에 scan_result.json 업로드
CLI → Spring Boot raw-results 보고
Spring → agent_tasks row 생성, RabbitMQ SCAN_REQUEST publish
Worker → RabbitMQ consume
Worker → Spring에 RUNNING 콜백
Worker → FastAPI POST /analyze 호출
FastAPI → S3 raw 다운로드 → 분석 파이프라인 → analysis_result.json S3 업로드
Worker → Spring에 DONE 또는 FAILED 콜백
Spring → scan/task 상태 반영 및 결과 비동기 적재
```

로컬 개발에서는 Worker/RabbitMQ 없이 FastAPI `/analyze`를 직접 호출해 로컬 파일이나 inline scan_result로 분석할 수 있습니다. 요청 형태는 `12_analyze_api.md`를 참고합니다.

## 5. 분석 파이프라인

`/analyze` 요청은 `app/services/analysis_service.py`가 오케스트레이션합니다.

진입 함수 `analyze_scan_result()`는 입력 출처에 따라 분기합니다.

| 입력 출처 | 파이프라인 함수 |
| --- | --- |
| S3 raw (`rawResultPath`) | `run_s3_analysis_pipeline()` |
| 로컬 파일 (`scan_result_path`) | `run_analysis_pipeline()` |
| inline 객체 (`scan_result`) | `run_analysis_pipeline_from_scan_result()` |

세 경로 모두 아래 공통 단계를 거칩니다.

```text
PREPARE_INPUT   prepare_analysis_pipeline_context()
                → 최상위 검증, findings 추출, valid/invalid 분리
ANALYZE_FINDINGS analyze_findings()
                → finding별 분석 (아래 6절)
FETCH_REFERENCES fetch_findings_references()
                → HasData 웹 검색으로 finding별 참고 링크 보강 (배치)
SAVE_RESULT     build_analysis_result_from_results() → 저장/업로드
```

## 6. finding 단위 분석 단계

`analyze_findings()`는 finding을 두 경로로 나눠 처리합니다.

```text
should_use_agent(finding)?
├─ 예 (HIGH/CRITICAL 또는 CVE 포함) → per-finding 경로 (analyze_finding)
└─ 아니오 (LOW/MEDIUM 단순 misconfig) → batch 경로 (한 번에 묶어 처리)
```

per-finding 경로(`analyze_finding()`)는 아래 순서로 동작합니다.

```text
AGENT    run_agent_for_finding()        도구로 컨텍스트 보강 (조건부)
  ↓
EXPLAIN  generate_finding_explanation() 설명 생성
  ↓
FIX      generate_finding_fix()         수정 제안 생성
  ↓
VERIFY   verify_and_maybe_regenerate()  fix 검증 후 필요 시 재생성 (조건부)
  ↓
RESULT   build_structured_analysis_result()
```

batch 경로는 `generate_findings_explanation_batch()` / `generate_findings_fix_batch()`로 여러 finding을 한 번에 처리하고(최대 `MAX_FINDINGS_PER_BATCH`개씩), 배치 실패 시 finding별 순차 처리로 fallback합니다. batch 경로에서도 VERIFY와 결과 조립은 finding별로 수행합니다.

| 단계 | 서비스 | 체인/그래프 | 단위 | 조건 | 문서 |
| --- | --- | --- | --- | --- | --- |
| AGENT | `agent_service.py` | `agent_chain.py` | finding | `AGENT_ENABLED` + HIGH/CRITICAL·CVE | `11_agent_graph.md` |
| EXPLAIN | `explain_service.py` | `explain_chain.py` | finding/batch | 항상 | `08_explain_chain.md` |
| FIX | `fix_service.py` | `fix_chain.py` | finding/batch | 항상 | `09_fix_chain.md` |
| VERIFY | `verify_service.py` | `verify_chain.py` | finding | `VERIFY_ENABLED` | `10_verify_chain.md` |
| REFERENCE | `reference_service.py` | HasData SERP | batch | `HASDATA_ENABLED` | `07_analysis_result_output.md` |
| RESULT | `result_service.py` | - | finding | 항상 | `07_analysis_result_output.md` |

## 7. 디렉토리 구조

```text
app/
  main.py              FastAPI 앱 + /health
  api/analysis.py      /analyze, /analysis 라우트
  schemas/             요청/응답 DTO (scan_result, analysis)
  loaders/             scan_result.json 로딩·검증
  services/            오케스트레이션 + 단계별 서비스
  chains/              LangChain 체인 (explain, fix, verify, agent)
  prompts/             프롬프트 정의
  tools/               에이전트 도구 (cve, web_search, code_context)
  core/                config, llm, llm_provider, s3, logging_utils
  worker/              RabbitMQ consumer, processor, Spring/FastAPI client

data/                  샘플 입력/출력 JSON
docs/                  본 문서
scripts/               개발용 스크립트 (모델 비교, 체인 점검, 부하 테스트)
tests/                 단위 테스트
```

## 8. LLM provider

분석 전 단계는 `app/core/llm.py`의 `get_llm()`을 통해 동일한 LLM을 사용하며, provider는 `LLM_PROVIDER` 환경변수로 선택합니다(`ollama` / `gms` / `anthropic`). 기본값은 로컬 `ollama`입니다. 자세한 설정은 `05_configuration.md`, 품질 비교는 `14_local_model_comparison.md`·`15_external_model_comparison.md`를 참고합니다.

## 9. 관련 문서

| 주제 | 문서 |
| --- | --- |
| 환경 셋업 | `01_fastapi_setup.md` ~ `04_s3_setup.md` |
| 설정/환경변수 | `05_configuration.md` |
| 입력/출력 형식 | `06_scan_result_input.md`, `07_analysis_result_output.md` |
| 체인/그래프 | `08_explain_chain.md` ~ `11_agent_graph.md` |
| API/연동 | `12_analyze_api.md`, `13_spring_fastapi_interface.md` |
| 모델 비교 | `14_local_model_comparison.md`, `15_external_model_comparison.md` |
| 테스트 | `16_test_guide.md` |
