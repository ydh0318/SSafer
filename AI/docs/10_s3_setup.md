# S3 설정

이 문서는 FastAPI AI 서버에서 S3 클라이언트를 생성하기 위한 환경변수와 설정 파일을 정리합니다.

## 1. 현재 완료된 작업

```text
boto3 의존성 추가
S3 환경변수 로딩 함수 추가
S3 설정 검증 로직 추가
S3 client factory 추가
S3 설정 단위 테스트 추가
```

아직 `scan_result.json` 다운로드와 `analysis_result.json` 업로드 로직은 구현하지 않았습니다.

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
APP_ANALYSIS_RESULT_S3_BUCKET=ssafer-scan-results-dev
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
export APP_ANALYSIS_RESULT_S3_BUCKET=ssafer-analysis-results-dev
```

## 4. 구현 위치

```text
app/core/config.py
app/core/s3.py
```

주요 함수:

```python
load_s3_settings()
create_s3_client()
```

## 5. 테스트

```bash
cd /home/eunsu/S14P31B105/AI
source .venv/bin/activate
python -m unittest tests.test_s3_config
```
