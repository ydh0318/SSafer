#!/usr/bin/env bash
# EC2 #1 (서비스 서버) 배포 스크립트
# Jenkins CI에서 호출: bash /home/ubuntu/ssafer/S14P31B105/Infra/scripts/deploy-ec2-1.sh
# 전제: /home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-1/prod/ 에 docker-compose.yml과 .env가 존재

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-1/prod}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== EC2 #1 배포 시작 ==="

if [[ ! -f "${ENV_FILE}" ]]; then
  log "ERROR: .env 파일이 없습니다: ${ENV_FILE}"
  exit 1
fi

cd "${DEPLOY_DIR}"

log "이미지 pull 시작..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

log "컨테이너 재시작..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

log "미사용 이미지 정리..."
docker image prune -af

log "Spring Boot 헬스체크 대기 (최대 120초)..."
for i in $(seq 1 24); do
  if curl -sf http://localhost:8080/actuator/health > /dev/null 2>&1; then
    log "Spring Boot 정상 기동 확인"
    break
  fi
  if [[ $i -eq 24 ]]; then
    log "ERROR: Spring Boot 헬스체크 타임아웃"
    exit 1
  fi
  log "  대기 중... (${i}/24)"
  sleep 5
done

log "=== EC2 #1 배포 완료 ==="
