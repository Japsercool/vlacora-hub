#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
fail=0; pass(){ echo "[PASS] $*"; }; failf(){ echo "[FAIL] $*"; fail=$((fail+1)); }; warn(){ echo "[WARN] $*"; }
command -v docker >/dev/null && pass 'Docker gevonden' || failf 'Docker ontbreekt'
docker compose config >/dev/null 2>&1 && pass 'Compose geldig' || failf 'Compose ongeldig'
for f in .env secrets/postgres_password.txt secrets/gateway_setup_token.txt secrets/gateway_master_key.txt; do [[ -s "$f" ]] && pass "$f aanwezig" || failf "$f ontbreekt"; done
pid="$(docker compose ps -q postgres 2>/dev/null || true)"; if [[ -n "$pid" ]]; then ports="$(docker inspect --format='{{json .NetworkSettings.Ports}}' "$pid")"; [[ "$ports" == *'"5432/tcp":null'* ]] && pass 'PostgreSQL 5432 niet gepubliceerd' || failf "PostgreSQL lijkt gepubliceerd: $ports"; else failf 'Postgres container niet actief'; fi
gid="$(docker compose ps -q gateway 2>/dev/null || true)"; [[ -n "$gid" ]] && pass 'Gateway container actief' || failf 'Gateway container niet actief'
[[ $fail -eq 0 ]] || exit 1
