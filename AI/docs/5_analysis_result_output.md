# analysis_result.json 출력 검증

이 문서는 AI 분석 결과인 `analysis_result.json` 출력 스키마 검증 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
analysis_result.json 최상위 필수 필드 검증
results 배열 및 resultCount 일치 여부 검증
result 단위 필수 필드 검증
fix 객체 상세 스키마 검증
입력 findings와 출력 results의 findingId 매핑 검증
저장 전 출력 검증
로드 후 출력 검증
```

## 2. 출력 파일

기본 출력 파일은 아래 위치에 저장합니다.

```text
data/analysis_result.json
```

## 3. 검증 파일

출력 스키마 검증 로직은 아래 파일에 있습니다.

```text
app/services/result_service.py
```

주요 함수:

```python
validate_analysis_result(analysis_result: dict) -> None
validate_finding_id_mapping(findings: list[dict], analysis_result: dict) -> None
validate_analysis_result_item(result: Any, index: int) -> None
validate_fix_schema(fix: Any, path: str = "fix") -> None
save_analysis_result(analysis_result: dict, output_path: str) -> Path
load_analysis_result(output_path: str) -> dict
```

## 4. analysis_result.json 최상위 필드

`analysis_result.json`은 아래 필드를 반드시 포함해야 합니다.

```text
schemaVersion
scanId
source
scannedAt
generatedAt
resultCount
results
```

검증 규칙:

```text
schemaVersion은 0.1이어야 함
scanId, source, scannedAt, generatedAt은 비어 있지 않은 string이어야 함
scannedAt, generatedAt은 ISO 8601 datetime 형식이어야 함
resultCount는 integer이어야 함
results는 array이어야 함
resultCount는 results 길이와 같아야 함
results 안의 findingId는 중복되지 않아야 함
```

## 5. result 단위 필드

`results` 배열의 각 항목은 아래 필드를 반드시 포함해야 합니다.

```text
findingId
ruleId
source
severity
file
line
title
maskedEvidence
explanation
fix
```

검증 규칙:

```text
line은 integer 또는 null이어야 함
fix를 제외한 필수 문자열 필드는 비어 있지 않은 string이어야 함
fix는 object이어야 함
```

## 6. fix 객체 필드

`fix` 객체는 아래 필드를 반드시 포함해야 합니다.

```text
summary
priority
recommendedActions
codeGuidance
verification
cautions
```

`fix.patches`는 CLI 자동 수정이 가능한 경우에만 포함하는 선택 필드입니다.
자동 수정이 어려운 finding은 기존 설명형 `fix`만 포함할 수 있습니다.

검증 규칙:

```text
summary, priority, codeGuidance, verification은 비어 있지 않은 string이어야 함
priority는 high, medium, low 중 하나여야 함
recommendedActions는 2~5개의 string 배열이어야 함
cautions는 1~3개의 string 배열이어야 함
patches가 있으면 1개 이상의 patch object를 담은 array여야 함
각 patch는 patchId, targetFile, operation, oldText, newText, requiresApproval을 반드시 포함해야 함
patch.operation은 현재 replace만 허용함
patchId, targetFile, operation, oldText, newText는 비어 있지 않은 string이어야 함
patch.requiresApproval은 boolean이어야 함
patch.expectedFileHash가 있으면 sha256:으로 시작해야 함
patch.rollback이 있으면 operation, oldText, newText를 반드시 포함해야 함
patch.rollback.operation은 현재 replace만 허용함
```

`fix.patches` 예시:

```json
[
  {
    "patchId": "PATCH-0001",
    "targetFile": "Dockerfile",
    "operation": "replace",
    "oldText": "USER root",
    "newText": "USER appuser",
    "expectedFileHash": "sha256:abc123",
    "requiresApproval": true,
    "rollback": {
      "operation": "replace",
      "oldText": "USER appuser",
      "newText": "USER root"
    }
  }
]
```

## 7. findingId 매핑 검증

전체 분석 파이프라인은 저장 전에 valid 입력 findings와 출력 results의 `findingId`가 1:1로 일치하는지 확인합니다.

검증 규칙:

```text
입력 finding id는 중복되지 않아야 함
출력 result findingId는 중복되지 않아야 함
입력 finding id마다 출력 result findingId가 존재해야 함
입력에 없는 findingId가 출력에 추가되면 안 됨
invalid finding은 분석 대상에서 제외되므로 매핑 검증 대상도 아님
```

오류 예시:

```text
analysis_result findingId mapping must match input findings: missing output findingId: FND-0002
analysis_result findingId mapping must match input findings: unexpected output findingId: FND-9999
Duplicate findingId in analysis_result: FND-0001
```

## 8. 검증 확인

아래 명령어로 기존 `analysis_result.json`이 출력 스키마를 만족하는지 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.services.result_service import load_analysis_result; result = load_analysis_result('data/analysis_result.json'); print('valid', result['resultCount'])"
```

정상 출력 예시:

```text
valid 3
```
