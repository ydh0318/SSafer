# AI — 보안 분석 서버

> SSAFER 보안 스캐닝 플랫폼의 **AI 분석 서버**. 코드 스캐너가 찾아낸 보안 취약점(finding)을 입력받아, 각 finding을 **이해하기 쉬운 한국어 설명**과 **구체적인 수정 제안**으로 변환합니다.

```text
scan_result.json                          analysis_result.json
(스캐너가 찾은 보안 finding 목록)   ──▶    (finding별 설명 + 수정 제안 + 참고자료)
                            AI 분석 파이프라인
```

LLM은 로컬 **Ollama**(`qwen2.5:3b`)를 기본으로 사용하며, 필요 시 **Claude**(SSAFY GMS gateway 또는 Anthropic 공식 API)로 전환할 수 있습니다.

## 목차

- [1. 무엇을 하는가](#1-무엇을-하는가)
- [2. 시스템에서의 위치](#2-시스템에서의-위치)
- [3. 분석 파이프라인](#3-분석-파이프라인)
- [4. 기술 스택](#4-기술-스택)
- [5. 시작하기](#5-시작하기)
- [6. 실행](#6-실행)
- [7. API 사용법](#7-api-사용법)
- [8. 설정](#8-설정)
- [9. 디렉토리 구조](#9-디렉토리-구조)
- [10. 테스트](#10-테스트)
- [11. 문서](#11-문서)

---

## 1. 무엇을 하는가

코드/서버 스캐너는 취약점을 **찾기**만 합니다. 개발자는 "이게 왜 위험한지", "어떻게 고쳐야 하는지"를 따로 판단해야 합니다. 이 서버는 그 간극을 메웁니다.

입력 finding 하나당 아래를 생성합니다.

- **설명(explanation)** — 취약점 요약, 위험한 이유, 악용 시나리오, 예상 영향, 심각도 해석 (5개 섹션, 한국어)
- **수정 제안(fix)** — 요약, 우선순위, 구체적 조치, 코드 가이드, 검증 방법, 주의사항. CLI가 자동 적용할 수 있는 경우 **patch**(코드 치환안)도 포함
- **참고자료(references)** — 관련 웹 문서 링크

결과는 입력 `scan_result.json`과 1:1로 매핑되는 `analysis_result.json`으로 저장됩니다. 출력 스키마는 [docs/07_analysis_result_output.md](docs/07_analysis_result_output.md)를 참고합니다.

## 2. 시스템에서의 위치

이 서버는 단독으로도(로컬 파일 분석) 동작하지만, 운영에서는 더 큰 파이프라인의 한 단계입니다.

```text
CLI 스캐너 ──(scan_result.json)──▶ S3
    │                                ▲                       │
    └──(보고)──▶ Spring Boot ──(RabbitMQ: 분석요청)──▶ Worker ─┤
                     ▲                                        │
                     │                              POST /analyze
                     │                                        ▼
                     └────(상태/결과 콜백)──────────────── FastAPI (이 서버)
                                                             │
                                                  (analysis_result.json)
                                                             ▼
                                                            S3
```

**두 개의 프로세스로 구성됩니다.**

| 컴포넌트 | 역할 | 진입점 |
| --- | --- | --- |
| **FastAPI** | `/analyze`로 분석 요청을 받아 파이프라인 실행 | `app/main.py` |
| **Worker** | RabbitMQ 메시지 consume → FastAPI 호출 → Spring 콜백 | `app/worker/async_consumer.py` |

둘은 같은 코드베이스를 공유하지만 별도 프로세스로 실행합니다. 외부 연동은 **S3**(입력 raw·결과 저장), **RabbitMQ**(작업 큐), **Spring Boot**(상태/결과 콜백)입니다. 전체 계약은 [docs/13_spring_fastapi_interface.md](docs/13_spring_fastapi_interface.md), 구조 개요는 [docs/00_architecture_overview.md](docs/00_architecture_overview.md)에 있습니다.

> 로컬 개발에서는 RabbitMQ·Spring 없이 FastAPI `/analyze`만으로 파일/inline 입력을 바로 분석할 수 있습니다.

## 3. 분석 파이프라인

`/analyze` 요청은 `app/services/analysis_service.py`가 오케스트레이션하며, finding마다 아래 단계를 거칩니다.

```text
입력 검증        scan_result.json 파싱·검증, valid/invalid finding 분리
   ↓
AGENT (옵션)     CVE/코드/웹 도구로 컨텍스트 보강 (HIGH·CRITICAL 또는 CVE finding)
   ↓
EXPLAIN          취약점 설명 5개 섹션 생성
   ↓
FIX              수정 제안(+필요 시 patch) 생성
   ↓
VERIFY (옵션)    fix가 finding을 실제로 해결하는지 검증, 실패 시 재생성
   ↓
REFERENCE        HasData 웹 검색으로 참고 링크 보강
   ↓
결과 조립/저장   analysis_result.json 생성 → 로컬 파일 또는 S3 저장
```

- **EXPLAIN / FIX**는 항상 실행되며, finding이 여러 개면 배치로 묶어 처리합니다.
- **AGENT**(`AGENT_ENABLED`)와 **VERIFY**(`VERIFY_ENABLED`)는 기본 비활성이며, 켜면 품질이 올라가는 대신 LLM 호출이 늘어납니다.

각 단계 상세: [explain](docs/08_explain_chain.md) · [fix](docs/09_fix_chain.md) · [verify](docs/10_verify_chain.md) · [agent + 도구](docs/11_agent_graph.md).

## 4. 기술 스택

| 영역 | 사용 |
| --- | --- |
| 웹 서버 | FastAPI, Uvicorn |
| LLM 오케스트레이션 | LangChain, LangGraph (agent) |
| LLM provider | Ollama(로컬) / GMS gateway / Anthropic |
| 스키마 검증 | Pydantic |
| 메시지 큐 | RabbitMQ (aio-pika / pika) |
| 스토리지 | AWS S3 (boto3) |
| 외부 API | NVD(CVE 조회), HasData(웹 검색) |

## 5. 시작하기

**사전 요구사항:** Python 3.10+, (로컬 LLM 사용 시) [Ollama](docs/02_ollama_setup.md).

아래 명령은 `AI/` 디렉토리 기준입니다.

```bash
# 1) 가상환경 + 의존성
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2) 환경변수 (필요한 값만)
cp .env.example .env   # 편집해서 키/버킷 등 채우기

# 3) 로컬 LLM 준비 (Ollama 사용 시)
ollama serve            # 별도 터미널에서 계속 실행
ollama pull qwen2.5:3b
```

## 6. 실행

**FastAPI 서버:**

```bash
uvicorn app.main:app --reload
# http://127.0.0.1:8000  (Swagger UI: /docs)
```

**Worker** (RabbitMQ 연동, 선택):

```bash
python -m app.worker.async_consumer
```

로컬 RabbitMQ 브로커 구동과 연동 점검 순서는 [docs/13_spring_fastapi_interface.md](docs/13_spring_fastapi_interface.md) §10을 참고합니다.

## 7. API 사용법

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 상태 확인 |
| `POST` | `/analyze` | `scan_result.json` 분석 → `analysis_result.json` 생성 |

**Health check**

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

**분석 요청** (로컬 파일 기반)

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

**응답 예시** (성공)

```json
{
  "status": "completed",
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 3,
  "invalid_finding_count": 0,
  "result_count": 3,
  "invalid_findings": []
}
```

요청 본문에 파일 경로 대신 `scan_result` 객체를 직접 넣거나(inline), S3 URI(`rawResultPath`/`analysisResultPath`)를 줄 수도 있습니다. 입력은 일반 코드 스캔(`PROJECT_FILE`)과 서버 점검(`SERVER_AUDIT`) 두 모드를 지원합니다. 전체 요청/응답·에러 스펙은 [docs/12_analyze_api.md](docs/12_analyze_api.md), 입력 형식은 [docs/06_scan_result_input.md](docs/06_scan_result_input.md)를 참고합니다.

## 8. 설정

모든 동작은 환경변수로 제어합니다. 자주 쓰는 값은 아래와 같고, 전체 목록·기본값은 [docs/05_configuration.md](docs/05_configuration.md), 샘플은 `.env.example`에 있습니다.

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LLM_PROVIDER` | `ollama` | `ollama` / `gms` / `anthropic` |
| `OLLAMA_MODEL` | `qwen2.5:3b` | 로컬 기본 모델 |
| `AGENT_ENABLED` | `false` | 에이전트 컨텍스트 보강 |
| `VERIFY_ENABLED` | `false` | fix 검증/재생성 |
| `APP_SCAN_RAW_S3_BUCKET` | 없음 | S3 입력 버킷 (S3 흐름 시 필수) |
| `APP_ANALYSIS_RESULT_S3_BUCKET` | 없음 | S3 출력 버킷 (S3 흐름 시 필수) |

## 9. 디렉토리 구조

```text
AI/
├── app/
│   ├── main.py          FastAPI 앱 + /health
│   ├── api/             /analyze 라우트
│   ├── schemas/         요청/응답 DTO (pydantic)
│   ├── loaders/         scan_result.json 로딩·검증
│   ├── services/        파이프라인 오케스트레이션 + 단계별 서비스
│   ├── chains/          LangChain 체인 (explain · fix · verify · agent)
│   ├── prompts/         프롬프트 정의
│   ├── tools/           에이전트 도구 (CVE · 웹검색 · 코드컨텍스트)
│   ├── core/            config · llm · llm_provider · s3 · logging
│   └── worker/          RabbitMQ consumer · processor · Spring/FastAPI client
├── data/                샘플 입력/출력 JSON
├── docs/                문서 (아래 색인)
├── scripts/             개발용 스크립트 (모델 비교, 체인 점검, 부하 테스트)
├── tests/               단위 테스트
├── requirements.txt
└── .env.example
```

## 10. 테스트

단위 테스트는 실제 LLM/외부 API 없이 mock으로 동작합니다.

```bash
source .venv/bin/activate
python -m unittest discover -s tests
```

상세 시나리오와 수동 점검 방법은 [docs/16_test_guide.md](docs/16_test_guide.md)를 참고합니다.

## 11. 문서

작업 흐름 순서로 정리돼 있습니다. 전체 색인은 [docs/README.md](docs/README.md).

| 분류 | 문서 |
| --- | --- |
| 개요 | [00_architecture_overview](docs/00_architecture_overview.md) |
| 셋업 | [01_fastapi_setup](docs/01_fastapi_setup.md) · [02_ollama_setup](docs/02_ollama_setup.md) · [03_langchain_setup](docs/03_langchain_setup.md) · [04_s3_setup](docs/04_s3_setup.md) · [05_configuration](docs/05_configuration.md) |
| 데이터 형식 | [06_scan_result_input](docs/06_scan_result_input.md) · [07_analysis_result_output](docs/07_analysis_result_output.md) |
| 체인/그래프 | [08_explain_chain](docs/08_explain_chain.md) · [09_fix_chain](docs/09_fix_chain.md) · [10_verify_chain](docs/10_verify_chain.md) · [11_agent_graph](docs/11_agent_graph.md) |
| API/연동 | [12_analyze_api](docs/12_analyze_api.md) · [13_spring_fastapi_interface](docs/13_spring_fastapi_interface.md) |
| 모델 비교 | [14_local_model_comparison](docs/14_local_model_comparison.md) · [15_external_model_comparison](docs/15_external_model_comparison.md) |
| 테스트 | [16_test_guide](docs/16_test_guide.md) |
