#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
echo 'PULSE Docker status'; docker compose ps
id="$(docker compose ps -q postgres 2>/dev/null || true)"; [[ -n "$id" ]] && echo "PostgreSQL health: $(docker inspect --format='{{.State.Health.Status}}' "$id" 2>/dev/null || true)"
gid="$(docker compose ps -q gateway 2>/dev/null || true)"; [[ -n "$gid" ]] && echo "Gateway health: $(docker inspect --format='{{.State.Health.Status}}' "$gid" 2>/dev/null || true)"
grep '^PULSE_GATEWAY_PUBLIC_URL=' .env 2>/dev/null || true
echo 'PostgreSQL 5432 hoort NIET gepubliceerd te zijn.'
