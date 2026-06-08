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
  echo "Missing $ENV_FILE." >&2
  exit 1
fi

APP_DOMAIN="$(read_env_key APP_DOMAIN)"

"${COMPOSE[@]}" ps

if [[ -n "$APP_DOMAIN" && "$APP_DOMAIN" != "app.example.com" ]]; then
  curl -fsS "https://${APP_DOMAIN}/api/healthz"
  echo
fi

"${COMPOSE[@]}" logs --tail=80 app
