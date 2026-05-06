#!/usr/bin/env bash
# EC2 #2 (analysis server) deploy script
# Called by Jenkins over SSH:
#   FASTAPI_IMAGE=... bash /home/ubuntu/ssafer/S14P31B105/Infra/scripts/deploy-ec2-2.sh
# Prerequisite:
#   /home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod/ contains docker-compose.yml and .env

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/ssafer/S14P31B105/Infra/docker/ec2-2/prod}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

check_env_key() {
  local key="$1"
  if [[ -n "${!key:-}" ]] || grep -Eq "^${key}=" "${ENV_FILE}"; then
    log "env ${key}=SET"
  else
    log "env ${key}=MISSING"
  fi
}

log "=== EC2 #2 deploy start ==="

if [[ ! -f "${ENV_FILE}" ]]; then
  log "ERROR: .env file not found: ${ENV_FILE}"
  exit 1
fi

log "DEPLOY_DIR=${DEPLOY_DIR}"
check_env_key "FASTAPI_IMAGE"
check_env_key "REDIS_LLM_PASSWORD"
check_env_key "ANTHROPIC_API_KEY"
check_env_key "EC2_1_PRIVATE_IP"
check_env_key "INTERNAL_TOKEN"

cd "${DEPLOY_DIR}"

log "Pull images..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

log "Restart containers..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans

log "Prune unused images..."
docker image prune -af

log "Wait for FastAPI healthcheck (max 60s)..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    log "FastAPI is healthy"
    break
  fi
  if [[ $i -eq 12 ]]; then
    log "ERROR: FastAPI healthcheck timed out"
    exit 1
  fi
  log "  waiting... (${i}/12)"
  sleep 5
done

log "=== EC2 #2 deploy complete ==="
