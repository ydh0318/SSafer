# AI 문서 목록

AI 모듈 문서는 주제별로 묶어 번호순으로 관리합니다. 처음 보는 경우 `00_architecture_overview.md`부터 읽으면 전체 그림을 잡을 수 있습니다.

## 문서 순서

```text
00_architecture_overview.md
01_fastapi_setup.md
02_ollama_setup.md
03_langchain_setup.md
04_s3_setup.md
05_configuration.md
06_scan_result_input.md
07_analysis_result_output.md
08_explain_chain.md
09_fix_chain.md
10_verify_chain.md
11_agent_graph.md
12_analyze_api.md
13_spring_fastapi_interface.md
14_local_model_comparison.md
15_external_model_comparison.md
16_test_guide.md
```

## 문서 설명

| 분류 | 문서 | 내용 |
| --- | --- | --- |
| 개요 | `00_architecture_overview.md` | 전체 구조, 컴포넌트, 처리 흐름, 분석 파이프라인 단계 |
| 셋업 | `01_fastapi_setup.md` | FastAPI 서버 가상환경, 실행, 기본 엔드포인트 확인 |
| 셋업 | `02_ollama_setup.md` | Ollama CLI 설치, 모델 설치, 모델 실행 확인 |
| 셋업 | `03_langchain_setup.md` | LangChain과 Ollama 연동 설정 |
| 셋업 | `04_s3_setup.md` | FastAPI S3 클라이언트 설정 및 환경변수 |
| 셋업 | `05_configuration.md` | 환경변수/설정 통합 레퍼런스 |
| 데이터 | `06_scan_result_input.md` | scan_result.json 입력 처리 |
| 데이터 | `07_analysis_result_output.md` | analysis_result.json 출력 검증 |
| 체인/그래프 | `08_explain_chain.md` | Explain Chain 구축 |
| 체인/그래프 | `09_fix_chain.md` | Fix Chain 구축 |
| 체인/그래프 | `10_verify_chain.md` | Verify Chain (fix 검증·재생성) |
| 체인/그래프 | `11_agent_graph.md` | Agent Graph + 도구(CVE/웹/코드 컨텍스트) |
| API/연동 | `12_analyze_api.md` | `/analyze` API 요청/응답 스펙 |
| API/연동 | `13_spring_fastapi_interface.md` | Spring Boot, Worker, FastAPI 연동 API 명세 |
| 모델 비교 | `14_local_model_comparison.md` | 로컬 모델 성능 비교 |
| 모델 비교 | `15_external_model_comparison.md` | Claude API, GMS gateway, Ollama 품질 비교 방법 |
| 테스트 | `16_test_guide.md` | 현재 구현 상태 기준 테스트 방법 |
