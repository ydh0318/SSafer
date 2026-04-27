# scan_result.json 입력 처리

이 문서는 `scan_result.json` 입력 처리 흐름을 정리합니다.

## 1. 현재 완료된 작업

```text
scan_result.json 파일 로딩 구현
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

## 4. 로딩 확인

아래 명령어로 `scan_result.json` 로딩을 확인할 수 있습니다.

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -c "from app.loaders.scan_loader import load_scan_result; data = load_scan_result('data/scan_result.json'); print(data['scanId'], len(data.keys()))"
```

정상 출력 예시:

```text
a36ae6b4-0eaf-44a1-bd24-1ce17c6a59cd 10
```

## 5. API 연결 확인

현재 `/analysis`는 `scan_result.json` 파일을 로딩한 뒤 상태를 반환합니다.

```bash
curl -X POST http://127.0.0.1:8000/analysis \
  -H "Content-Type: application/json" \
  -d '{"scan_result_path":"data/scan_result.json"}'
```

정상 응답 예시:

```json
{
  "status": "loaded",
  "message": "scan_result.json loaded. keys=10",
  "scan_result_path": "data/scan_result.json"
}
```

## 6. 다음 작업

```text
findings 배열 추출 로직 구현
finding 필수 필드 검증
finding → LLM 입력 데이터 변환
```
