# 설정 / 환경변수 레퍼런스

이 문서는 AI 모듈이 사용하는 환경변수를 한곳에 정리합니다. FastAPI 서버 설정은 `app/core/config.py`, Worker 설정은 `app/worker/config.py`에서 읽습니다.

샘플은 `.env.example`를 참고합니다. 모든 값은 환경변수로 주입하며, 지정하지 않으면 아래 기본값을 사용합니다.

## 1. LLM provider 선택

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LLM_PROVIDER` | `ollama` | 사용할 provider. `ollama`, `gms`, `anthropic` 중 하나 |

provider별 동작과 모델 선택은 `15_external_model_comparison.md`를 참고합니다.

## 2. Ollama (로컬 모델)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `qwen2.5:3b` | 기본 모델명 |
| `OLLAMA_TEMPERATURE` | `0.1` | 생성 temperature |
| `OLLAMA_TIMEOUT_SECONDS` | `600` | LLM 호출 timeout(초) |
| `OLLAMA_MAX_RETRIES` | `2` | 호출 실패 시 추가 재시도 횟수 |
| `OLLAMA_RETRY_BACKOFF_SECONDS` | `1` | 재시도 사이 대기 시간(초) |

> Ollama 재시도/타임아웃 설정은 provider와 무관하게 `invoke_llm_with_retry()`의 기본값으로도 쓰입니다.

## 3. Anthropic (공식 API)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 없음 | Anthropic Console에서 발급한 API Key |
| `ANTHROPIC_MODEL` | `claude-3-5-haiku-latest` | 사용할 Claude 모델 |
| `ANTHROPIC_TEMPERATURE` | `0.1` | 생성 temperature |
| `ANTHROPIC_TIMEOUT_SECONDS` | `600` | 호출 timeout(초) |

## 4. GMS (SSAFY gateway)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `GMS_API_KEY` | 없음 | GMS gateway API Key |
| `GMS_BASE_URL` | `https://gms.ssafy.io/gmsapi/api.openai.com/v1` | gateway base URL |
| `GMS_MODEL` | `gpt-5-mini` | 사용할 모델 |
| `GMS_TEMPERATURE` | `0.1` | 생성 temperature |
| `GMS_TIMEOUT_SECONDS` | `600` | 호출 timeout(초) |
| `GMS_FORCE_JSON_RESPONSE_FORMAT` | `false` | OpenAI 호환 `response_format` 강제 여부 |

> GMS는 모델명이 `claude-*`이면 Anthropic Messages API 호환 경로, 그 외에는 OpenAI 호환 경로로 호출합니다. Claude를 쓰려면 `GMS_BASE_URL`을 Anthropic 호환 endpoint로 바꿔야 합니다(`15_external_model_comparison.md` 참고).

## 5. LLM 토큰 / 동시성

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `LLM_EXPLAIN_MAX_TOKENS` | `900` | Explain 응답 최대 토큰 |
| `LLM_FIX_MAX_TOKENS` | `800` | Fix 응답 최대 토큰 |
| `LLM_VERIFY_MAX_TOKENS` | `200` | Verify 응답 최대 토큰 |
| `MAX_LLM_CONCURRENCY` | `10` | 동시에 처리할 LLM 호출 수(세마포어) |
| `MAX_FINDING_CONCURRENCY` | `5` | finding 동시 처리 상한 |

## 6. 배치 처리

여러 finding을 한 번의 LLM 호출로 묶어 처리할 때 사용합니다.

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MAX_FINDINGS_PER_BATCH` | `10` | 한 배치에 묶는 finding 최대 개수 |
| `MAX_BATCH_EXPLAIN_RETRIES` | `2` | 배치 Explain 재시도 횟수 |
| `MAX_BATCH_FIX_RETRIES` | `2` | 배치 Fix 재시도 횟수 |
| `LLM_BATCH_MAX_TOKENS_CAP` | `16000` | 배치 응답 토큰 상한 |

## 7. Verify (검증)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VERIFY_ENABLED` | `false` | fix 검증/재생성 단계 사용 여부 |
| `VERIFY_LLM_ENABLED` | `true` | LLM 기반 검증 사용 여부(룰 기반 통과 후, HIGH/CRITICAL + patches일 때만) |
| `MAX_VERIFY_RETRIES` | `1` | 검증 실패 시 fix 재생성 최대 횟수 |

상세 동작은 `10_verify_chain.md`를 참고합니다.

## 8. Agent (도구 기반 보강)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AGENT_ENABLED` | `false` | 에이전트 컨텍스트 보강 사용 여부 |
| `AGENT_MAX_ITERATIONS` | `3` | 에이전트 최대 반복 횟수 |

상세 동작과 도구는 `11_agent_graph.md`를 참고합니다.

## 9. NVD (CVE 조회 도구)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `NVD_API_KEY` | 없음 | NVD API Key(있으면 rate limit 완화) |
| `NVD_API_ENDPOINT` | `https://services.nvd.nist.gov/rest/json/cves/2.0` | NVD API v2.0 endpoint |
| `NVD_TIMEOUT_SECONDS` | `10` | 조회 timeout(초) |
| `NVD_CACHE_MAX_SIZE` | `512` | CVE 결과 LRU 캐시 크기 |

## 10. HasData (웹 검색 도구)

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `HASDATA_ENABLED` | `true` | 웹 검색 도구 사용 여부 |
| `HASDATA_API_KEY` | 없음 | HasData SERP API Key(없으면 검색 비활성) |
| `HASDATA_SERP_ENDPOINT` | `https://api.hasdata.com/scrape/google` | SERP endpoint |
| `HASDATA_TIMEOUT_SECONDS` | `30` | 요청 timeout(초) |
| `HASDATA_MAX_RESULTS` | `5` | 반환 결과 상한 |

> HasData는 두 곳에서 쓰입니다: 에이전트 도구 `search_web`(`11_agent_graph.md`)와, 모든 finding에 대해 항상 실행되는 참고자료 조회 단계(`reference_service`). 후자는 결과의 `references` 필드로 들어갑니다(`07_analysis_result_output.md`). 둘 다 `HASDATA_ENABLED`/`HASDATA_API_KEY` 설정을 공유합니다.

## 11. S3

자세한 내용은 `04_s3_setup.md`를 참고합니다.

| 환경변수 | 기본값 | 필수 | 설명 |
| --- | --- | --- | --- |
| `APP_SCAN_RAW_S3_BUCKET` | 없음 | 예 | raw `scan_result.json` 다운로드 bucket |
| `APP_ANALYSIS_RESULT_S3_BUCKET` | 없음 | 예 | `analysis_result.json` 업로드 bucket |
| `AWS_REGION` | `ap-northeast-2` | 아니오 | S3 region |
| `AWS_ACCESS_KEY_ID` | 없음 | 아니오 | access key(secret과 함께 설정) |
| `AWS_SECRET_ACCESS_KEY` | 없음 | 아니오 | secret key(access key와 함께 설정) |
| `AWS_S3_ENDPOINT_URL` | 없음 | 아니오 | LocalStack/MinIO 등 S3 호환 endpoint |
| `S3_MAX_RETRIES` | `2` | 아니오 | S3 다운로드/업로드 재시도 횟수 |
| `S3_RETRY_BACKOFF_SECONDS` | `1` | 아니오 | S3 재시도 사이 대기 시간(초) |

> `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`는 둘 다 설정하거나 둘 다 비워야 합니다. 둘 다 없으면 boto3 기본 credential chain을 사용합니다. `APP_*_S3_BUCKET`은 S3 흐름(`rawResultPath` 사용)에서만 필수입니다.

## 12. Worker

`app/worker/config.py`가 읽습니다. 연동 의미는 `13_spring_fastapi_interface.md`를 참고합니다.

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ port |
| `RABBITMQ_USERNAME` | `guest` | RabbitMQ username |
| `RABBITMQ_PASSWORD` | `guest` | RabbitMQ password |
| `RABBITMQ_VIRTUAL_HOST` | `/` | RabbitMQ virtual host |
| `AGENT_TASK_SCAN_REQUEST_QUEUE` | `ssafer.agent.scan.request` | consume 대상 queue |
| `FASTAPI_BASE_URL` | `http://127.0.0.1:8000` | FastAPI 서버 주소 |
| `SPRING_BASE_URL` | `http://127.0.0.1:8080` | Spring Boot 서버 주소 |
| `SPRING_API_SECRET` | 없음 | Spring 내부 인증 secret(있으면 `X-Worker-Secret` 헤더 전송) |
| `WORKER_ANALYSIS_RESULT_PREFIX` | `analysis` | `analysisResultPath` 생성용 S3 prefix |
| `WORKER_HTTP_TIMEOUT_SECONDS` | `120` | Spring/FastAPI HTTP 호출 timeout |
| `WORKER_MAX_CONCURRENCY` | `5` | 동시에 처리할 메시지 수 |
| `WORKER_SHUTDOWN_TIMEOUT_SECONDS` | `1800` | graceful shutdown 대기 시간 |
| `WORKER_REDELIVERY_CAP` | `5` | 같은 메시지 재전달 허용 상한 |
| `WORKER_HTTP_MAX_RETRIES` | `2` | HTTP 호출 재시도 횟수 |
| `WORKER_HTTP_RETRY_BACKOFF_SECONDS` | `1` | 재시도 시작 backoff(초) |
| `WORKER_HTTP_RETRY_BACKOFF_MAX_SECONDS` | `30` | 재시도 backoff 상한(초) |

## 13. 기타

| 환경변수 | 설명 |
| --- | --- |
| `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_ENDPOINT`, `LANGSMITH_PROJECT` | LangChain/LangSmith 트레이싱(선택). LangChain 라이브러리가 직접 사용 |

> `docker-compose` 배포용 변수(`COMPOSE_PROJECT_NAME`, `*_IMAGE`, `*_CONTAINER_NAME`, `RESTART_POLICY` 등)는 애플리케이션 코드가 아니라 인프라 compose 파일이 사용합니다.
