#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
[[ "${1:-}" == '--skip-backup' ]] || "$ROOT/scripts/BACKUP_PULSE_DOCKER.sh"
docker compose pull postgres caddy || true
docker compose build --pull gateway
domain="$(grep '^PULSE_GATEWAY_DOMAIN=' .env | cut -d= -f2- || true)"
if [[ -n "$domain" ]]; then docker compose --profile https up -d; else docker compose -f docker-compose.yml -f docker-compose.local.yml up -d; fi
sleep 5
"$ROOT/scripts/VERIFY_PULSE_DOCKER.sh"
