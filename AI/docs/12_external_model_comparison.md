# Claude API 연동 및 Ollama 품질 비교

## API 선택 기준

이번 단계에서는 서버 환경에서 빠르게 검증할 수 있도록 GMS를 먼저 사용합니다. GMS가 `claude-3-5-haiku-latest` 모델을 Anthropic Messages API 호환 endpoint로 제공하므로, 별도 Anthropic API Key 없이 GMS Key로 Claude 품질 비교를 진행할 수 있습니다.

Anthropic 공식 API는 이후 토큰 사용량, 과금, 모델 버전 통제, GMS 제약 확인이 필요할 때 추가 검증 경로로 사용합니다. 이 경우 Claude 앱 구독이 아니라 Anthropic Console에서 발급받은 API Key가 필요합니다.

GMS 방식은 Anthropic Messages API 호환 endpoint를 사용합니다.

따라서 이 프로젝트에서는 아래처럼 구분합니다.

| provider | 용도 | 대표 모델 |
| --- | --- | --- |
| `ollama` | 로컬 모델 기본 분석 | `qwen2.5:3b` |
| `gms` | SSAFY GMS gateway로 Claude 우선 검증 | `claude-3-5-haiku-latest` |
| `anthropic` | Anthropic 공식 API로 Claude 직접 호출 | `claude-3-5-haiku-latest` |

## 환경변수

```bash
LLM_PROVIDER=ollama

ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-5-haiku-latest
ANTHROPIC_TEMPERATURE=0.1
ANTHROPIC_TIMEOUT_SECONDS=600

GMS_API_KEY=your_gms_api_key
GMS_BASE_URL=https://gms.ssafy.io/gmsapi/api.anthropic.com
GMS_MODEL=claude-3-5-haiku-latest
GMS_TEMPERATURE=0.1
GMS_TIMEOUT_SECONDS=600
GMS_FORCE_JSON_RESPONSE_FORMAT=false
```

## 분석 서비스 provider 변경

기본 운영은 로컬 Ollama를 우선 사용합니다.

```bash
LLM_PROVIDER=ollama
```

GMS gateway로 Claude Haiku를 테스트하려면 아래처럼 변경합니다.

```bash
LLM_PROVIDER=gms
GMS_API_KEY=your_gms_api_key
GMS_MODEL=claude-3-5-haiku-latest
```

Anthropic 공식 API로 직접 호출하려면 아래처럼 변경합니다.

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## 품질 비교 실행

기존 Ollama 모델만 비교할 수 있습니다.

```bash
python scripts/compare_local_models.py \
  --models ollama:llama3.2:3b ollama:qwen2.5:3b \
  --limit 3 \
  --output data/model_comparison_result.json
```

Ollama와 GMS Claude를 함께 비교할 수 있습니다.

```bash
python scripts/compare_local_models.py \
  --models ollama:qwen2.5:3b gms:claude-3-5-haiku-latest \
  --limit 3 \
  --output data/model_comparison_result.json
```

기본 Ollama 목록에 현재 `GMS_MODEL`을 추가하려면 아래 옵션을 사용합니다.

```bash
python scripts/compare_local_models.py --include-gms
```

Anthropic 공식 API까지 같이 실험하려면 provider prefix를 명시합니다.

```bash
python scripts/compare_local_models.py \
  --models ollama:qwen2.5:3b gms:claude-3-5-haiku-latest anthropic:claude-3-5-haiku-latest
```

GMS Claude는 Anthropic Messages API 호환 endpoint를 사용합니다. 따라서 OpenAI 전용 `response_format={"type": "json_object"}`는 적용하지 않습니다. Fix Chain은 프롬프트에서 JSON만 출력하도록 요구하고, 응답 파서에서 JSON을 검증합니다.

## 결과 저장 형식

비교 결과는 provider와 model을 함께 저장합니다.

```json
{
  "provider": "gms",
  "model": "claude-3-5-haiku-latest",
  "target": "gms:claude-3-5-haiku-latest",
  "summary": {
    "findingCount": 3,
    "explanationSuccessCount": 3,
    "fixSuccessCount": 3,
    "totalElapsedMs": 0,
    "averageElapsedMsPerFinding": 0
  }
}
```

## 기본 판단

현재 기본 판단은 GMS 우선입니다.

1차로 `gms:claude-3-5-haiku-latest`가 서버 환경에서 호출되는지 확인합니다. 이후 토큰 사용량 관리, 비용 추적, GMS 모델 지원 제약, 응답 품질 이슈가 있으면 `anthropic` provider로 공식 API 직접 호출을 비교합니다.
