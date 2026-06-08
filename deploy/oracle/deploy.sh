#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ORACLE_ENV_FILE:-.env.oracle}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.oracle.yml)

read_env_key() {
  local key="$1"
  local name
  local value=""

  while IFS='=' read -r name value || [[ -n "$name" ]]; do
    name="${name#$'\xef\xbb\xbf'}"
    name="${name%$'\r'}"
    if [[ "$name" == "$key" ]]; then
      break
    fi
    value=""
  done < "$ENV_FILE"

  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it first:" >&2
  echo "  cp .env.oracle.example $ENV_FILE" >&2
  echo "  nano $ENV_FILE" >&2
  exit 1
fi

bash deploy/oracle/validate-env.sh

APP_DOMAIN="$(read_env_key APP_DOMAIN)"
if [[ -z "$APP_DOMAIN" || "$APP_DOMAIN" == "app.example.com" ]]; then
  echo "Set APP_DOMAIN in $ENV_FILE before deploying." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Run bash deploy/oracle/bootstrap-ubuntu.sh first." >&2
  exit 1
fi

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" run --rm --workdir /app app pnpm run db:push
"${COMPOSE[@]}" up -d

echo "Waiting for https://${APP_DOMAIN}/api/healthz ..."
for attempt in {1..30}; do
  if curl -fsS "https://${APP_DOMAIN}/api/healthz" >/dev/null; then
    echo "Deploy healthy: https://${APP_DOMAIN}"
    exit 0
  fi
  sleep 5
done

echo "Deploy did not become healthy. Recent app logs:" >&2
"${COMPOSE[@]}" logs --tail=80 app >&2
exit 1
