# S3 Presigned Upload CORS Guide

## 배경

현재 업로드 스캔 흐름은 브라우저가 백엔드에서 받은 presigned URL로 S3에 직접 `PUT` 업로드하는 구조다.

관련 코드:

- 프론트 업로드 호출:
  [Frontend/src/features/scans/api/scans.ts](</c:/Users/SSAFY/Desktop/S14P31B105/Frontend/src/features/scans/api/scans.ts:141>)
- 백엔드 presigned URL 발급:
  [Backend/ssafer/src/main/java/com/ssafer/scan/infrastructure/s3/S3RawUploadUrlIssuer.java](</c:/Users/SSAFY/Desktop/S14P31B105/Backend/ssafer/src/main/java/com/ssafer/scan/infrastructure/s3/S3RawUploadUrlIssuer.java:29>)

이 구조에서는 브라우저가 S3에 `PUT` 요청을 보내기 전에 `OPTIONS` preflight를 먼저 보낸다. 따라서 S3 버킷 CORS가 정확히 잡혀 있지 않으면 업로드가 presigned URL 자체는 정상이어도 브라우저에서 차단된다.

대표 증상:

- 콘솔에 `No 'Access-Control-Allow-Origin' header is present`
- `Failed to fetch`
- `net::ERR_FAILED`

## 현재 서비스에서 필요한 Origin

저장소 기준으로 현재 허용해야 하는 주요 origin은 아래와 같다.

- `http://localhost:5173`
- `https://ssafer.co.kr`
- `https://www.ssafer.co.kr`

근거:

- [Backend/ssafer/src/main/java/com/ssafer/global/config/WebMvcConfig.java](</c:/Users/SSAFY/Desktop/S14P31B105/Backend/ssafer/src/main/java/com/ssafer/global/config/WebMvcConfig.java:14>)
- [Frontend/.env.example](</c:/Users/SSAFY/Desktop/S14P31B105/Frontend/.env.example:11>)

## 권장 S3 CORS 설정

raw scan upload bucket에는 아래 CORS를 권장한다.

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://ssafer.co.kr",
      "https://www.ssafer.co.kr"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

이 프로젝트에서는 presigned PUT 요청에 `Content-Type: application/json`을 붙이고 있으므로 `AllowedHeaders`는 최소 `content-type`을 포함해야 한다. 운영 편의상 `*`를 권장한다.

## 버킷별 적용 대상

### Dev

- raw scan bucket 예시:
  `ssafer-scan-storage-dev`
- 관련 예시 env:
  [Infra/docker/ec2-1/dev/.env.example](</c:/Users/SSAFY/Desktop/S14P31B105/Infra/docker/ec2-1/dev/.env.example:28>)

### Prod

- raw scan bucket 예시:
  `ssafer-scan-storage-prod`
- 관련 예시 env:
  [Infra/docker/ec2-1/prod/.env.example](</c:/Users/SSAFY/Desktop/S14P31B105/Infra/docker/ec2-1/prod/.env.example:28>)

dev/prod 버킷이 분리되어 있다면 두 버킷 모두 별도로 CORS를 설정해야 한다.

## AWS Console 적용 방법

1. AWS S3 콘솔에서 대상 bucket을 연다.
2. `Permissions` 탭으로 이동한다.
3. `Cross-origin resource sharing (CORS)` 섹션을 연다.
4. 위 JSON을 붙여넣고 저장한다.
5. 저장 후 브라우저에서 다시 업로드를 시도한다.

## AWS CLI 적용 방법

`cors.json` 파일을 만든 뒤 아래처럼 적용한다.

```bash
aws s3api put-bucket-cors \
  --bucket ssafer-scan-storage-dev \
  --cors-configuration file://cors.json
```

적용 확인:

```bash
aws s3api get-bucket-cors \
  --bucket ssafer-scan-storage-dev
```

prod도 같은 방식으로 bucket 이름만 바꿔 적용한다.

## 검증 체크리스트

- presigned URL 발급은 정상인가
- 브라우저 origin이 CORS AllowedOrigins에 포함되는가
- `PUT` 메서드가 허용되는가
- `Content-Type` 헤더가 허용되는가
- 브라우저 개발자도구 Network 탭에서 `OPTIONS` preflight 응답에 `Access-Control-Allow-Origin`이 보이는가
- 저장 후 캐시 이슈를 피하려면 새 presigned URL로 다시 시도했는가

## 서버 프록시 전환 검토

현재 구조는 브라우저 -> S3 direct upload 방식이다.

### 장점

- 백엔드가 대용량 파일 바디를 중계하지 않아도 된다
- 서버 대역폭과 메모리 사용량이 줄어든다
- 업로드 URL 만료 정책을 통해 제어가 간단하다

### 단점

- S3 CORS 설정이 필수다
- 브라우저별 preflight 이슈를 직접 맞닥뜨린다
- 업로드 실패가 백엔드 로그에 남지 않아 운영 추적성이 약하다

### 서버 프록시 방식

대안은 브라우저가 파일을 백엔드에 업로드하고, 백엔드가 S3에 다시 업로드하는 방식이다.

흐름:

1. 브라우저 -> Spring Boot multipart upload
2. Spring Boot -> S3 PutObject
3. Spring Boot가 raw upload 완료 처리까지 내부에서 이어감

### 서버 프록시 방식 장점

- 브라우저-S3 CORS 문제를 제거할 수 있다
- 인증, 파일 검증, 로깅, 감사 추적을 백엔드에서 일원화할 수 있다
- 업로드 실패 원인을 백엔드 로그로 더 쉽게 수집할 수 있다

### 서버 프록시 방식 단점

- 백엔드가 파일 바디를 직접 받아야 해서 트래픽 부담이 증가한다
- 대용량 업로드 시 서버/로드밸런서 타임아웃과 메모리 전략을 신경 써야 한다
- 지금의 presigned direct upload 구조보다 운영비와 서버 책임이 커진다

## 권장 결론

이 프로젝트는 raw JSON 업로드가 주 용도이고, 이미 presigned upload 구조가 잘 들어가 있으므로 1차 대응은 S3 CORS를 바로잡는 것이 가장 비용 대비 효과가 좋다.

권장 순서:

1. dev/prod raw upload bucket에 CORS를 정확히 설정한다.
2. 프론트에서 CORS 원인을 바로 알 수 있는 오류 메시지를 제공한다.
3. 업로드 파일 크기와 운영 트래픽이 커지거나 감사 추적 요구가 강해질 때 서버 프록시 방식으로 전환을 검토한다.
