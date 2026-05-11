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
patch.targetFile은 저장소 루트 기준 상대 경로여야 함
patch.targetFile은 절대 경로, 홈 경로, 상위 경로(..), 역슬래시를 포함하면 안 됨
patch.requiresApproval은 true여야 함
patch.oldText와 patch.newText는 서로 달라야 함
patch.oldText와 patch.newText는 마스킹된 민감 값 토큰을 포함하면 안 됨
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

## 7. CLI 적용 가능한 patch contract

CLI는 `fix.patches`의 각 patch를 아래 순서로 검증한 뒤 적용해야 합니다.

```text
targetFile을 저장소 루트 기준 상대 경로로 해석함
targetFile이 저장소 밖을 가리키면 patch 적용 불가
expectedFileHash가 있으면 로컬 대상 파일의 sha256 값과 비교함
operation은 replace만 처리함
oldText가 대상 파일에서 정확히 1번만 매칭되는지 확인함
oldText가 0번 또는 2번 이상 매칭되면 patch 적용 불가
oldText와 newText로 diff preview를 생성함
requiresApproval이 true이므로 사용자 승인 전에는 파일을 수정하지 않음
승인 후 적용 전 대상 파일 backup을 생성함
적용 실패 또는 사용자 취소 시 원본 파일을 유지함
rollback은 보조 정보이며, 실제 복구의 기준은 CLI가 만든 backup이어야 함
```

`replace` 적용 규칙:

```text
대상 파일 전체에서 oldText를 newText로 한 번 치환함
oldText는 줄바꿈과 공백을 포함해 원문과 정확히 일치해야 함
CLI는 치환 전후 diff를 사용자에게 보여줘야 함
```

## 8. patch 생성 가능/불가능 조건

AI는 아래 조건을 모두 만족할 때만 `fix.patches`를 생성해야 합니다.

```text
scan artifact 안에 targetFile을 특정할 수 있음
scan artifact 안에 정확한 oldText를 특정할 수 있음
oldText가 실제 파일에서 고유하게 1번만 등장할 가능성이 높음
newText가 기존 코드 흐름을 크게 추측하지 않고 만들 수 있음
secret 원문, token, password, key 값을 oldText 또는 newText에 포함하지 않음
변경 방식이 현재 지원하는 replace operation으로 표현 가능함
사용자 검토가 필요한 수정임을 requiresApproval=true로 표시할 수 있음
```

AI는 아래 경우 `fix.patches`를 생성하지 않고 설명형 `fix`만 작성해야 합니다.

```text
대상 파일 경로나 정확한 oldText를 알 수 없음
oldText가 여러 위치에 있을 가능성이 높음
newText를 만들려면 주변 코드, 프레임워크, 설정을 추측해야 함
새 비밀 값이나 민감 값을 생성하거나 복원해야 함
maskedEvidence처럼 마스킹된 값만 있어 실제 치환 텍스트를 알 수 없음
여러 파일의 의미 있는 리팩터링이나 의존성 추가가 필요함
append, delete, unified diff 등 replace 이외의 작업이 필요함
로컬 파일 해시 또는 파일 내용 확인 없이는 안전성을 판단하기 어려움
```

## 9. findingId 매핑 검증

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

## 10. 검증 확인

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
