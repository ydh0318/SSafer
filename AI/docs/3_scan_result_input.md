# scan_result.json 입력 처리

이 문서는 `scan_result.json` 입력 처리 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
scan_result.json 파일 로딩 구현
findings 배열 추출 로직 구현
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

## 4. Findings 추출

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

## 5. 로딩 및 추출 확인

아래 명령어로 `scan_result.json` 로딩과 `findings` 추출을 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.loaders.scan_loader import load_scan_result, extract_findings; data = load_scan_result('data/scan_result.json'); findings = extract_findings(data); print(len(findings), findings[0]['id'], findings[-1]['id'])"
```

정상 출력 예시:

```text
3 FND-0001 FND-0003
```

## 6. API 연결 확인

현재 `/analysis`는 `scan_result.json` 파일을 로딩하고 `findings` 배열을 추출한 뒤 상태를 반환합니다.

```bash
curl -X POST http://127.0.0.1:8000/analysis \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json"}'
```

정상 응답 예시:

```json
{
  "status": "loaded",
  "message": "scan_result.json loaded. findings=3",
  "scan_result_path": "data/scan_result.json",
  "finding_count": 3
}
```

## 7. 다음 작업

```text
finding 필수 필드 검증
finding → LLM 입력 데이터 변환
```
