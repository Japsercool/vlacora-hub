#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
mkdir -p secrets backups data/files data/gateway logs
docker compose config >/dev/null
domain="$(grep '^PULSE_GATEWAY_DOMAIN=' .env | cut -d= -f2- || true)"
if [[ -n "$domain" ]]; then docker compose --profile https up -d --build; else docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build; fi
"$ROOT/scripts/VERIFY_PULSE_DOCKER.sh"
