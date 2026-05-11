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
  local value="${!key:-}"

  if [[ -z "${value}" ]] && grep -Eq "^${key}=" "${ENV_FILE}"; then
    value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d '=' -f 2-)"
  fi

  if [[ -z "${value// }" ]]; then
    log "env ${key}=MISSING"
    return 1
  fi

  if [[ "${value}" == *REPLACE* ]]; then
    log "env ${key}=PLACEHOLDER"
    return 1
  fi

  log "env ${key}=SET"
}

# Allows placeholder values. Use only for keys that are intentionally dummy during staged rollout.
check_env_present_allow_placeholder() {
  local key="$1"
  local value="${!key:-}"

  if [[ -z "${value}" ]] && grep -Eq "^${key}=" "${ENV_FILE}"; then
    value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d '=' -f 2-)"
  fi

  if [[ -z "${value// }" ]]; then
    log "env ${key}=MISSING"
    return 1
  fi

  log "env ${key}=SET"
}

print_diagnostics() {
  log "Docker compose ps:"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps || true

  log "FastAPI recent logs:"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --tail=80 fastapi || true
}

log "=== EC2 #2 deploy start ==="

if [[ ! -f "${ENV_FILE}" ]]; then
  log "ERROR: .env file not found: ${ENV_FILE}"
  exit 1
fi

log "DEPLOY_DIR=${DEPLOY_DIR}"
missing_env=0
check_env_key "FASTAPI_IMAGE" || missing_env=1
check_env_present_allow_placeholder "ANTHROPIC_API_KEY" || missing_env=1
check_env_key "AWS_ACCESS_KEY_ID" || missing_env=1
check_env_key "AWS_SECRET_ACCESS_KEY" || missing_env=1
check_env_key "AWS_REGION" || missing_env=1
check_env_key "APP_SCAN_RAW_S3_BUCKET" || missing_env=1
check_env_key "APP_ANALYSIS_RESULT_S3_BUCKET" || missing_env=1
check_env_key "RABBITMQ_HOST" || missing_env=1
check_env_key "RABBITMQ_PORT" || missing_env=1
check_env_key "RABBITMQ_PASSWORD" || missing_env=1
check_env_key "SPRING_BASE_URL" || missing_env=1
check_env_key "SPRING_API_SECRET" || missing_env=1

if [[ "${missing_env}" -ne 0 ]]; then
  log "ERROR: required environment values are missing or still placeholders"
  exit 1
fi

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
    print_diagnostics
    exit 1
  fi
  log "  waiting... (${i}/12)"
  sleep 5
done

log "=== EC2 #2 deploy complete ==="
