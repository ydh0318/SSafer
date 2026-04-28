#!/usr/bin/env bash
# EC2 #2 (분석 서버) 배포 스크립트
# Jenkins CI에서 SSH로 호출: ssh ubuntu@ec2-2 'bash /home/ubuntu/ssafer/scripts/deploy-ec2-2.sh'
# 전제: /home/ubuntu/ssafer/ec2-2/prod/ 에 docker-compose.yml과 .env가 존재

set -euo pipefail

DEPLOY_DIR="/home/ubuntu/ssafer/ec2-2/prod"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== EC2 #2 배포 시작 ==="

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

log "FastAPI 헬스체크 대기 (최대 60초)..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    log "FastAPI 정상 기동 확인"
    break
  fi
  if [[ $i -eq 12 ]]; then
    log "ERROR: FastAPI 헬스체크 타임아웃"
    exit 1
  fi
  log "  대기 중... (${i}/12)"
  sleep 5
done

log "=== EC2 #2 배포 완료 ==="
