#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ORACLE_ENV_FILE:-.env.oracle}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.oracle.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Refusing to update without production env." >&2
  exit 1
fi

bash deploy/oracle/validate-env.sh

git pull --ff-only
"${COMPOSE[@]}" build app
"${COMPOSE[@]}" run --rm --workdir /app app pnpm run db:push
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
