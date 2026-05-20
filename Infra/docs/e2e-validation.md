# E2E Validation

`S14P31B105-161` 기준 운영 배포 후 E2E 검증 체크리스트입니다.

## 목표

웹 업로드 또는 CLI 스캔 요청부터 분석 완료 결과 표시까지 전체 파이프라인을 검증합니다.

```text
업로드 요청
→ Spring Boot
→ PostgreSQL metadata 저장
→ S3 scan_result.json 저장/조회
→ FastAPI 분석 요청
→ Claude/HasData 호출
→ S3 analysis_result.json 저장
→ Spring internal callback
→ DB status DONE
→ Frontend 결과 표시
```

## 사전 조건

- EC2 #1 Docker compose 기동 완료
- EC2 #2 Docker compose 기동 완료
- S3 bucket 접근 가능
- EC2 #1 → EC2 #2 `8000/tcp` 통신 가능
- EC2 #2 → EC2 #1 `8080/tcp` 통신 가능
- `INTERNAL_TOKEN` 값이 EC2 #1, EC2 #2에서 동일

## 인프라 Healthcheck

EC2 #1:

```bash
docker compose --env-file .env -f /var/lib/jenkins/ssafer/S14P31B105/Infra/docker/ec2-1/prod/docker-compose.yml ps
curl -sf http://localhost:8080/actuator/health
curl -Ik https://<LEGACY_DEPLOY_DOMAIN>
```

EC2 #2:

```bash
docker compose --env-file .env -f /home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod/docker-compose.yml ps
curl -sf http://localhost:8000/health
```

서버 간 통신:

```bash
# EC2 #1에서 실행
curl -sf http://<EC2_2_PRIVATE_IP>:8000/health

# EC2 #2에서 실행
curl -sf http://<EC2_1_PRIVATE_IP>:8080/actuator/health
```

## 보안 라우팅 검증

외부 PC에서 확인합니다.

```bash
curl -Ik https://<LEGACY_DEPLOY_DOMAIN>
curl -Ik https://<LEGACY_DEPLOY_DOMAIN>/api/v1/internal/callback
```

기대 결과:

- `/` 또는 정적 페이지는 200 또는 정상 리다이렉트
- `/api/v1/internal/**`은 NGINX에서 403

## S3 검증

```bash
aws s3 ls s3://<AWS_S3_BUCKET>/scans/
```

분석 요청 후 아래 객체가 생성되어야 합니다.

```text
scans/{scanId}/scan_result.json
scans/{scanId}/analysis_result.json
```

## 애플리케이션 시나리오

1. 웹 또는 CLI에서 샘플 프로젝트 스캔을 요청합니다.
2. Spring DB에서 `scan_results.status = UPLOADED` 또는 `ANALYZING` 상태를 확인합니다.
3. FastAPI 로그에서 분석 요청 수신을 확인합니다.
4. S3에 `analysis_result.json` 생성 여부를 확인합니다.
5. Spring 로그에서 internal callback 수신을 확인합니다.
6. DB status가 `DONE`으로 전환되는지 확인합니다.
7. Frontend 결과 화면에서 분석 결과가 표시되는지 확인합니다.

## 장애 시 확인 순서

1. NGINX 라우팅: `/api/v1/**` proxy 여부
2. Spring health: `/actuator/health`
3. PostgreSQL 연결과 Flyway migration
4. S3 credential 및 bucket name
5. EC2 #1 → EC2 #2 private IP 통신
6. FastAPI health와 LLM API key
7. EC2 #2 → EC2 #1 callback 통신
8. `INTERNAL_TOKEN` 불일치 여부

## Jira 완료 코멘트

```markdown
E2E 통합 테스트 완료

- EC2 #1/EC2 #2 컨테이너 상태 확인
- NGINX HTTPS 및 internal endpoint 403 확인
- Spring → FastAPI 분석 요청 확인
- FastAPI → S3 analysis_result.json 저장 확인
- FastAPI → Spring callback 확인
- DB status DONE 전환 확인
- Frontend 결과 표시 확인

검증:
- docker compose ps
- /actuator/health
- /health
- aws s3 ls
- 서비스 로그 확인
```
