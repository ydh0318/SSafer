# scan_result.json 입력 처리

이 문서는 `scan_result.json` 입력 처리 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
scan_result.json 파일 로딩 구현
scan_result.json 요청 DTO 정의
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

scan_result.json DTO와 JSON 파일 로딩 함수는 아래 파일에 있습니다.

```text
app/schemas/scan_result.py
app/loaders/scan_loader.py
```

현재 구현된 함수:

```python
parse_scan_result(scan_result: dict) -> dict
parse_finding(finding: dict, index: int) -> dict
load_scan_result(scan_result_path: str) -> dict
```

처리 내용:

```text
ScanResult DTO 기준 최상위 필드 파싱
ScanFinding DTO 기준 개별 finding 파싱
상대 경로를 프로젝트 실행 위치 기준 경로로 변환
파일 존재 여부 확인
UTF-8 BOM 포함 JSON 파일 로딩 지원
JSON 파싱 실패 처리
JSON root object 여부 확인
```

## 3-1. scan_result.json DTO

최상위 DTO:

```python
class ScanResult(BaseModel):
    schema_version: Literal["0.1"] = Field(alias="schemaVersion")
    scan_id: str | None = Field(default=None, alias="scanId")          # project scan: 필수 (UUID v4)
    audit_id: str | None = Field(default=None, alias="auditId")        # server-audit: 필수 (UUID v4)
    source: str
    scanned_at: str | None = Field(default=None, alias="scannedAt")    # project scan: 필수
    generated_at: str | None = Field(default=None, alias="generatedAt")  # server-audit: 필수
    analysis_status: (
        Literal["SUCCESS", "PARTIAL", "PARTIAL_SUCCESS", "FAILED"] | None
    ) = Field(default=None, alias="analysisStatus")                    # project scan: 필수
    findings: list[Any]
```

Finding DTO:

```python
class ScanFinding(BaseModel):
    id: str
    rule_id: str = Field(alias="ruleId")
    source: str
    severity: str
    title: str
    file: str | None = None                                           # project scan: 필수
    line: int | None = None
    masked_evidence: str | None = Field(default=None, alias="maskedEvidence")  # project scan: 필수
    target: str | None = None                                         # server-audit: 필수
    evidence: str | None = None                                       # server-audit: evidence 또는 maskedEvidence 필수
    patch_context: FindingPatchContext | None = Field(default=None, alias="patchContext")
```

- `source`는 임의의 비어 있지 않은 문자열입니다(예: `cli`, `server-audit`, `custom-rule`). 특정 값으로 제한하지 않습니다.
- `findings`는 `list[Any]`로 두어, 일부 finding이 잘못돼도 전체 요청을 실패시키지 않고 개별 finding만 invalid로 분리합니다.
- `ScanResult`/`ScanFinding`은 `extra="allow"`라 `toolVersion`, `warnings`, `artifacts`, `sourceFileHashes`, `cliSummary` 같은 부가 필드를 보존합니다.
- `patchContext`(`FindingPatchContext`)는 CLI 자동수정 힌트로, `operation`(`replace`/`append`), `oldText`, `expectedFileHash`(`sha256:`로 시작)를 가집니다. Fix Chain이 patch를 만들 때 참고합니다.
- 입력은 **project scan**과 **server-audit** 두 모드로 검증됩니다. 모드별 필수 필드는 §4-1을 참고합니다.

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

검증/파싱 함수:

```python
parse_scan_result(scan_result: dict) -> dict
validate_scan_result_required_fields(scan_result: dict) -> None
```

검증 규칙:

```text
필수 필드 누락 여부 확인
schemaVersion, scanId, source, scannedAt, analysisStatus는 비어 있지 않은 string이어야 함
schemaVersion은 지원 버전이어야 함
scanId는 UUID v4 형식이어야 함
scannedAt은 ISO 8601 datetime 형식이어야 함
analysisStatus는 SUCCESS, PARTIAL, PARTIAL_SUCCESS, FAILED 중 하나여야 함
findings는 배열이어야 함
```

> `validate_scan_result_required_fields`는 정규화 이후 결과에 적용됩니다. server-audit 입력은 `auditId`/`generatedAt`이 정규화 단계에서 `scanId`/`scannedAt`로 채워진 뒤 위 규칙을 통과합니다(§4-1). `source` 값 자체는 제한하지 않습니다(비어 있지 않으면 됨).

## 4-1. server-audit 입력 모드

입력은 `source`(또는 `auditId`/`target` 유무)로 두 모드를 자동 판별합니다(`infer_scan_type`).

| 모드 | scanType | 최상위 필수 | finding 필수 |
| --- | --- | --- | --- |
| project scan | `PROJECT_FILE` | `scanId`(UUID v4), `scannedAt`, `analysisStatus` | `file`, `maskedEvidence` |
| server-audit | `SERVER_AUDIT` | `auditId`(UUID v4), `generatedAt` | `target`, `evidence` 또는 `maskedEvidence` |

판별 규칙: `source == "server-audit"`이거나 최상위에 `auditId`가 있으면 server-audit입니다.

server-audit는 분석 전 아래처럼 정규화됩니다(`normalize_scan_result`).

```text
finding.target        → file (없을 때)
finding.evidence      → maskedEvidence (없을 때)
auditId               → scanId (없을 때)
generatedAt           → scannedAt (없을 때)
analysisStatus 없으면 → "SUCCESS"
```

server-audit finding에는 CLI 자동수정 patch를 만들지 않고 운영 가이드형 `fix`만 생성합니다. 자세한 내용은 `07_analysis_result_output.md`와 `10_verify_chain.md`를 참고합니다.

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
parse_finding(finding: dict, index: int) -> dict
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

> 위 필수 목록은 project scan 기준입니다. server-audit finding은 `file`/`maskedEvidence` 대신 `target`과 `evidence`(또는 `maskedEvidence`)를 사용하며, 정규화 단계에서 `target`→`file`, `evidence`→`maskedEvidence`로 채워집니다(§4-1).

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
python -c "from app.loaders.scan_loader import load_scan_result, extract_findings, validate_scan_result_required_fields, split_valid_invalid_findings; from app.services.input_service import format_finding_for_llm; data = load_scan_result('data/scan_result.json'); validate_scan_result_required_fields(data); findings = extract_findings(data); valid, invalid = split_valid_invalid_findings(findings); inputs = [format_finding_for_llm(f) for f in valid]; print('prepared', len(inputs), 'invalid', len(invalid)); print(inputs[0])"
```

정상 출력 예시:

```text
prepared 3 invalid 0
Finding ID: FND-0001
...
```

## 9. API 연결 확인

이 입력은 `/analyze` API로 분석합니다. 파일 경로, inline `scan_result` 객체, S3 raw 입력 등 요청 형태와 응답 스펙은 `12_analyze_api.md`를 참고합니다.