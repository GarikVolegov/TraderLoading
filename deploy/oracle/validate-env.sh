#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="${SCRIPT_PATH%/*}"
if [[ "$SCRIPT_DIR" == "$SCRIPT_PATH" ]]; then
  SCRIPT_DIR="."
fi
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ORACLE_ENV_FILE:-.env.oracle}"

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

failures=0

require_value() {
  local key="$1"
  local value
  value="$(read_env_key "$key")"

  if [[ -z "$value" ]]; then
    echo "Missing required env: $key" >&2
    failures=$((failures + 1))
    return
  fi

  case "$value" in
    app.example.com|pk_live_or_test_value|sk_live_or_test_value|change-this*|mailto:noreply@example.com)
      echo "Replace placeholder env: $key" >&2
      failures=$((failures + 1))
      ;;
  esac
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it from .env.oracle.example first." >&2
  exit 1
fi

require_value APP_DOMAIN
require_value POSTGRES_PASSWORD
require_value DATABASE_URL
require_value API_CORS_ORIGINS
require_value CLERK_PUBLISHABLE_KEY
require_value CLERK_SECRET_KEY
require_value VITE_CLERK_PUBLISHABLE_KEY
require_value VAPID_PUBLIC_KEY
require_value VAPID_PRIVATE_KEY
require_value VAPID_EMAIL

database_url="$(read_env_key DATABASE_URL)"
postgres_password="$(read_env_key POSTGRES_PASSWORD)"
if [[ -n "$database_url" && -n "$postgres_password" && "$database_url" != *"$postgres_password"* ]]; then
  echo "DATABASE_URL should contain the same password as POSTGRES_PASSWORD." >&2
  failures=$((failures + 1))
fi

app_domain="$(read_env_key APP_DOMAIN)"
cors_origins="$(read_env_key API_CORS_ORIGINS)"
if [[ -n "$app_domain" && -n "$cors_origins" && "$cors_origins" != *"$app_domain"* ]]; then
  echo "API_CORS_ORIGINS should include APP_DOMAIN." >&2
  failures=$((failures + 1))
fi

if [[ "$failures" -gt 0 ]]; then
  echo "Oracle env validation failed with $failures issue(s)." >&2
  exit 1
fi

echo "Oracle env validation passed."
