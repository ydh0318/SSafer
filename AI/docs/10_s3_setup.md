# S3 설정

이 문서는 FastAPI AI 서버에서 S3 클라이언트를 생성하기 위한 환경변수와 설정 파일을 정리합니다.

## 1. 현재 완료된 작업

```text
boto3 의존성 추가
S3 환경변수 로딩 함수 추가
S3 설정 검증 로직 추가
S3 client factory 추가
scan_result.json 다운로드 로직 추가
analysis_result.json 업로드 로직 추가
S3 설정 단위 테스트 추가
```

아직 `/analyze` API와 S3 다운로드/업로드 흐름은 직접 연결하지 않았습니다.

## 2. 환경변수

필수:

| 이름 | 설명 |
| --- | --- |
| `AWS_S3_BUCKET` | 기본 S3 bucket |

선택:

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `AWS_REGION` | `ap-northeast-2` | S3 region |
| `APP_SCAN_RAW_S3_BUCKET` | `AWS_S3_BUCKET` | scan_result.json 다운로드 bucket |
| `APP_ANALYSIS_RESULT_S3_BUCKET` | `AWS_S3_BUCKET` | analysis_result.json 업로드 bucket |
| `AWS_ACCESS_KEY_ID` | 없음 | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | 없음 | AWS secret key |
| `AWS_S3_ENDPOINT_URL` | 없음 | LocalStack/MinIO 같은 S3 호환 endpoint |

`AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`는 둘 중 하나만 설정할 수 없습니다. 둘 다 없으면 boto3 기본 credential chain을 사용합니다.

## 3. 로컬 예시

AI 모듈에는 아래 예시 파일을 추가했습니다.

```text
.env.example
```

dev 기준 bucket 값은 Infra 문서를 참고해 아래처럼 분리했습니다.

```text
APP_SCAN_RAW_S3_BUCKET=ssafer-scan-storage-dev
APP_ANALYSIS_RESULT_S3_BUCKET=ssafer-scan-storage-dev
```

```bash
export AWS_REGION=ap-northeast-2
export AWS_S3_BUCKET=ssafer-scan-storage-dev
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

bucket을 분리하려면 아래 값을 추가합니다.

```bash
export APP_SCAN_RAW_S3_BUCKET=ssafer-scan-storage-dev
export APP_ANALYSIS_RESULT_S3_BUCKET=ssafer-scan-storage-dev
```

## 4. 구현 위치

```text
app/core/config.py
app/core/s3.py
app/services/s3_service.py
```

주요 함수:

```python
load_s3_settings()
create_s3_client()
parse_s3_uri()
resolve_raw_scan_location()
resolve_analysis_result_location()
download_scan_result_json()
upload_analysis_result_json()
```

## 5. 테스트

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_s3_config
python -m unittest tests.test_s3_download
python -m unittest tests.test_s3_upload
```

실제 S3 다운로드 연결 확인:

```bash
set -a
source .env
set +a

python - <<'PY'
from pathlib import Path
from app.services.s3_service import download_scan_result_json

path = download_scan_result_json(
    "ai-test/connection-test.txt",
    "data/s3_download_test.txt",
)

print(path)
print(Path(path).read_text())
PY
```

정상 출력 예시:

```text
/home/eunsu/S14P31B105/AI/data/s3_download_test.txt
ok
```

## 6. scan_result.json 다운로드

객체 key만 전달하면 `APP_SCAN_RAW_S3_BUCKET` bucket에서 다운로드합니다.

```python
download_scan_result_json(
    object_key_or_uri="scans/1/scan_result.json",
    destination_path="data/scan_result.json",
)
```

전체 S3 URI도 사용할 수 있습니다.

```python
download_scan_result_json(
    object_key_or_uri="s3://ssafer-scan-storage-dev/scans/1/scan_result.json",
    destination_path="data/scan_result.json",
)
```

필요 권한:

```text
s3:GetObject
```

다운로드한 파일은 `destination_path`에 지정한 로컬 경로에 저장됩니다. 예를 들어 `destination_path="data/scan_result.from_s3.json"`이면 AI 프로젝트 기준 아래 파일로 저장됩니다.

```text
/home/eunsu/S14P31B105/AI/data/scan_result.from_s3.json
```

## 7. analysis_result.json 업로드

객체 key만 전달하면 `APP_ANALYSIS_RESULT_S3_BUCKET` bucket으로 업로드합니다.

```python
upload_analysis_result_json(
    source_path="data/analysis_result.json",
    object_key_or_uri="analysis/1/analysis_result.json",
)
```

전체 S3 URI도 사용할 수 있습니다.

```python
upload_analysis_result_json(
    source_path="data/analysis_result.json",
    object_key_or_uri="s3://ssafer-scan-storage-dev/analysis/1/analysis_result.json",
)
```

업로드가 성공하면 저장된 S3 URI를 반환합니다.

```text
s3://ssafer-scan-storage-dev/analysis/1/analysis_result.json
```

필요 권한:

```text
s3:PutObject
```

실제 S3 업로드 연결 확인:

```bash
set -a
source .env
set +a

python - <<'PY'
from app.services.s3_service import upload_analysis_result_json

s3_uri = upload_analysis_result_json(
    "data/analysis_result.json",
    "ai-test/analysis_result.upload_test.json",
)

print(s3_uri)
PY
```
