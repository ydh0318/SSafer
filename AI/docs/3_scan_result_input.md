# scan_result.json 입력 처리

이 문서는 `scan_result.json` 입력 처리 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
scan_result.json 파일 로딩 구현
scan_result.json 최상위 필수 필드 검증
findings 배열 추출 로직 구현
finding 필수 필드 검증
invalid finding 분리 처리
finding → LLM 입력 데이터 변환
```

## 2. 샘플 입력 파일

샘플 입력 파일은 아래 위치에 있습니다.

```text
data/scan_result.json
```

## 3. 로더 파일

JSON 파일 로딩 함수는 아래 파일에 있습니다.

```text
app/loaders/scan_loader.py
```

현재 구현된 함수:

```python
load_scan_result(scan_result_path: str) -> dict
```

처리 내용:

```text
상대 경로를 프로젝트 실행 위치 기준 경로로 변환
파일 존재 여부 확인
UTF-8 BOM 포함 JSON 파일 로딩 지원
JSON 파싱 실패 처리
JSON root object 여부 확인
```

## 4. scan_result.json 필수 필드 검증

`scan_result.json` 최상위 객체는 아래 필드를 반드시 포함해야 합니다.

```text
schemaVersion
scanId
source
scannedAt
analysisStatus
findings
```

검증 함수:

```python
validate_scan_result_required_fields(scan_result: dict) -> None
```

검증 규칙:

```text
필수 필드 누락 여부 확인
schemaVersion, scanId, source, scannedAt, analysisStatus는 비어 있지 않은 string이어야 함
schemaVersion은 지원 버전이어야 함
scanId는 UUID v4 형식이어야 함
source는 허용된 source 값이어야 함
scannedAt은 ISO 8601 datetime 형식이어야 함
analysisStatus는 SUCCESS, PARTIAL, FAILED 중 하나여야 함
findings는 배열이어야 함
```

## 5. Findings 추출

`scan_result.json`에서 AI 분석 대상이 되는 `findings` 배열을 추출합니다.

현재 구현된 함수:

```python
extract_findings(scan_result: dict) -> list[dict]
```

처리 내용:

```text
findings 필드 존재 여부 확인
findings 필드가 배열인지 확인
findings 배열의 각 항목이 JSON object인지 확인
```

## 6. Finding 필수 필드 검증

각 finding은 아래 필드를 반드시 포함해야 합니다.

```text
id
ruleId
source
severity
file
line
title
maskedEvidence
```

검증 함수:

```python
validate_finding_required_fields(finding: dict, index: int) -> None
validate_findings_required_fields(findings: list[dict]) -> None
split_valid_invalid_findings(findings: list) -> tuple[list[dict], list[dict]]
```

검증 규칙:

```text
필수 필드 누락 여부 확인
line은 integer 또는 null 허용
line을 제외한 필수 필드는 비어 있지 않은 string이어야 함
```

invalid finding은 전체 입력을 실패시키지 않고 아래 형식으로 분리합니다.

```json
{
  "index": 1,
  "findingId": "FND-0002",
  "reason": "findings[1] missing required fields: maskedEvidence"
}
```

`findingId`를 확인할 수 없는 경우에는 `null`로 기록합니다.

## 7. LLM 입력 데이터 변환

검증을 통과한 valid finding만 LLM에 전달하기 좋은 텍스트 형식으로 변환합니다.

변환 함수:

```python
format_finding_for_llm(finding: dict) -> str
format_findings_for_llm(findings: list[dict]) -> list[str]
```

변환 결과 예시:

```text
Finding ID: FND-0001
Rule ID: ENV_PLAIN_SECRET
Source: custom-rule
Severity: HIGH
File: .env
Line: 1
Title: 환경변수 파일에 시크릿이 하드코딩됨: DB_PASSWORD
Evidence:
DB_PASSWORD=***MASKED***
```

## 8. 로딩, 추출, 검증, 변환 확인

아래 명령어로 `scan_result.json` 로딩, `findings` 추출, valid/invalid 분리, LLM 입력 변환을 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.loaders.scan_loader import load_scan_result, extract_findings, validate_scan_result_required_fields, split_valid_invalid_findings; from app.services.input_service import format_findings_for_llm; data = load_scan_result('data/scan_result.json'); validate_scan_result_required_fields(data); findings = extract_findings(data); valid, invalid = split_valid_invalid_findings(findings); inputs = format_findings_for_llm(valid); print('prepared', len(inputs), 'invalid', len(invalid)); print(inputs[0])"
```

정상 출력 예시:

```text
prepared 3 invalid 0
Finding ID: FND-0001
...
```

## 9. API 연결 확인

현재 `/analyze`는 `scan_result.json` 파일을 로딩한 뒤 분석 파이프라인을 실행하고 `analysis_result.json`을 저장합니다.

```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json","analysis_result_path":"data/analysis_result.json"}'
```

정상 응답 예시:

```json
{
  "status": "completed",
  "message": null,
  "stage": null,
  "finding_id": null,
  "scan_result_path": "data/scan_result.json",
  "analysis_result_path": "data/analysis_result.json",
  "finding_count": 3,
  "valid_finding_count": 3,
  "invalid_finding_count": 0,
  "result_count": 3,
  "invalid_findings": []
}
```

## 10. 다음 작업

```text
Explain Chain 구축
```
