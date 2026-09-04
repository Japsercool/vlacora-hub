#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"; stamp="$(date +%Y%m%d-%H%M%S)"; tmp="logs/diagnostics-$stamp"; mkdir -p "$tmp"
docker version > "$tmp/docker-version.txt" 2>&1; docker compose version > "$tmp/compose-version.txt" 2>&1; docker compose ps > "$tmp/compose-ps.txt" 2>&1; docker compose logs --tail 500 --no-color gateway postgres caddy > "$tmp/docker-logs.txt" 2>&1 || true
sed -E 's/(KEY|PASSWORD|TOKEN)=.*/\1=***REDACTED***/' .env > "$tmp/env-redacted.txt" 2>/dev/null || true
cp server-config.json INSTALLATION_REPORT.txt VERSION.txt "$tmp/" 2>/dev/null || true
tar -czf "logs/PULSE_DIAGNOSTICS_$stamp.tar.gz" -C logs "diagnostics-$stamp"; rm -rf "$tmp"; echo "Diagnostiek: logs/PULSE_DIAGNOSTICS_$stamp.tar.gz"
