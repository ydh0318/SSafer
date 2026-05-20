# 로컬 모델 성능 비교

이 문서는 Ollama 로컬 모델의 AI 분석 품질을 비교하고 기본 모델을 선정하는 기준을 정리합니다.

## 1. 비교 대상

기본 비교 대상은 아래 모델입니다.

```text
llama3.2:3b
qwen2.5:3b
```

현재 설치 확인 결과:

```text
llama3.2:3b 설치됨
qwen2.5:3b 설치됨
```

## 1-1. 추천 비교 모델 조합

AI 분석 품질 개선을 위해 아래 모델 조합을 우선 비교합니다.

```text
qwen2.5:3b
→ 현재 기본 모델 후보. 한국어 응답이 llama3.2보다 안정적이었음.

qwen2.5:7b
→ 3B보다 품질이 좋아질 가능성이 큼. 속도 비교용으로 꼭 추천.

qwen2.5-coder:3b
→ 수정 제안, 코드/설정 변경 안내 품질 확인용.

qwen2.5-coder:7b
→ Fix Chain JSON 품질과 코드성 제안 품질 비교용.

gemma3:4b
→ 작은 모델 중 한국어와 지시 따르기 비교 후보.

mistral:7b
→ 빠르고 효율적인 7B 계열 기준선.

llama3.2:3b
→ 기존 baseline. 비교 기준으로 유지.
```

최소 비교 세트:

```text
llama3.2:3b
qwen2.5:3b
qwen2.5:7b
qwen2.5-coder:7b
```

전체 비교 세트:

```text
llama3.2:3b
qwen2.5:3b
qwen2.5:7b
qwen2.5-coder:3b
qwen2.5-coder:7b
gemma3:4b
mistral:7b
```

## 2. 비교 기준

각 모델은 동일한 `scan_result.json`의 valid finding을 대상으로 평가합니다.

평가 항목:

```text
Explain Chain 성공 여부
Explain Chain 금지 문자 포함 여부
Fix Chain JSON 파싱 성공 여부
Fix Chain 스키마 검증 성공 여부
finding당 평균 응답 시간
```

정량 기준:

```text
explanationSuccessCount
fixSuccessCount
explanationDisallowedScriptCount
averageElapsedMsPerFinding
```

## 3. 비교 스크립트

비교 스크립트는 아래 파일에 있습니다.

```text
scripts/compare_local_models.py
```

기본 실행:

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python scripts/compare_local_models.py
```

모델을 직접 지정하려면 아래처럼 실행합니다.

```bash
python scripts/compare_local_models.py --models llama3.2:3b qwen2.5:3b
```

finding 개수를 줄여 빠르게 확인하려면 아래처럼 실행합니다.

```bash
python scripts/compare_local_models.py --limit 1
```

결과는 기본적으로 아래 파일에 저장됩니다.

```text
data/model_comparison_result.json
```

## 4. 모델 설치

Ollama 서버를 먼저 실행합니다.

```bash
ollama serve
```

설치된 모델을 확인합니다.

```bash
ollama list
```

`qwen2.5:3b`가 없다면 아래 명령어로 설치합니다.

```bash
ollama pull qwen2.5:3b
```

추천 비교 모델을 모두 설치하려면 아래 명령어를 순서대로 실행합니다.

```bash
ollama pull qwen2.5:3b
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:3b
ollama pull qwen2.5-coder:7b
ollama pull gemma3:4b
ollama pull mistral:7b
ollama pull llama3.2:3b
```

설치가 끝나면 다시 목록을 확인합니다.

```bash
ollama list
```

## 4-1. 추천 조합 비교 실행

최소 비교 세트를 실행합니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate

python scripts/compare_local_models.py \
  --models llama3.2:3b qwen2.5:3b qwen2.5:7b qwen2.5-coder:7b \
  --limit 3 \
  --output data/model_comparison_result.json
```

전체 비교 세트를 실행합니다.

```bash
python scripts/compare_local_models.py \
  --models llama3.2:3b qwen2.5:3b qwen2.5:7b qwen2.5-coder:3b qwen2.5-coder:7b gemma3:4b mistral:7b \
  --limit 3 \
  --output data/model_comparison_result.json
```

빠르게 확인하려면 `--limit 1`로 줄입니다.

```bash
python scripts/compare_local_models.py \
  --models llama3.2:3b qwen2.5:3b qwen2.5:7b qwen2.5-coder:7b \
  --limit 1
```

## 5. 선정 기준

최적 모델은 아래 우선순위로 선정합니다.

```text
1. Fix Chain JSON 파싱 및 스키마 성공률
2. Explain Chain 금지 문자 미포함률
3. finding에 없는 내용 단정이 적은지
4. 한국어 자연스러움
5. 평균 응답 시간
```

AI 분석 파이프라인에서 `fix`는 구조화된 JSON으로 저장되므로, 속도보다 JSON 안정성을 우선합니다.

## 6. 현재 결론

`data/scan_result.json`의 valid finding 3개를 기준으로 추천 후보 7개 모델을 비교했습니다.

실행 명령:

```bash
python scripts/compare_local_models.py \
  --models llama3.2:3b qwen2.5:3b qwen2.5:7b qwen2.5-coder:3b qwen2.5-coder:7b gemma3:4b mistral:7b \
  --limit 3 \
  --output data/model_comparison_result.json
```

측정 결과:

| 모델 | Explain 성공 | Fix 성공 | 금지 문자 | 평균 시간 |
| --- | ---: | ---: | ---: | ---: |
| `llama3.2:3b` | 2/3 | 3/3 | 1 | 28641ms |
| `qwen2.5:3b` | 3/3 | 3/3 | 0 | 13681ms |
| `qwen2.5:7b` | 3/3 | 3/3 | 0 | 23898ms |
| `qwen2.5-coder:3b` | 3/3 | 3/3 | 0 | 15756ms |
| `qwen2.5-coder:7b` | 3/3 | 3/3 | 0 | 20651ms |
| `gemma3:4b` | 3/3 | 3/3 | 0 | 20161ms |
| `mistral:7b` | 3/3 | 3/3 | 0 | 34646ms |

정량 지표 기준으로 `qwen2.5:3b`가 가장 안정적이었습니다.

```text
qwen2.5:3b
- Explain Chain 3건 모두 성공
- Fix Chain 3건 모두 JSON 파싱 및 스키마 검증 성공
- 금지 문자 감지 0건
- 평균 응답 시간이 전체 후보 중 가장 짧음
```

최종 기본 모델은 아래 모델로 선정합니다.

```text
qwen2.5:3b
```

선정 이유:

```text
Fix Chain JSON 안정성이 모든 finding에서 통과
Explain Chain 출력도 모든 finding에서 성공
금지 문자 감지 없이 한국어 응답 제약을 만족
비교 후보 중 평균 응답 시간이 가장 짧음
7B 모델 대비 품질 지표는 유지하면서 실행 비용이 낮음
```

설정 파일의 기본 모델도 `qwen2.5:3b`로 변경했습니다.

```text
app/core/config.py
```
