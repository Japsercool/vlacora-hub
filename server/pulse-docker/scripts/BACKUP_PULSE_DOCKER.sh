#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
RETENTION_DAYS="${1:-$(grep '^PULSE_BACKUP_RETENTION_DAYS=' .env 2>/dev/null | cut -d= -f2 || echo 30)}"
stamp="$(date +%Y%m%d-%H%M%S)"; dest="$ROOT/backups/pulse-$stamp"; mkdir -p "$dest"
cid="$(docker compose ps -q postgres)"; [[ -n "$cid" ]] || { echo 'Postgres container ontbreekt' >&2; exit 1; }
docker compose exec -T postgres sh -lc 'pg_dump -U pulse_app -d pulse -Fc -f /tmp/pulse-backup.dump'
docker cp "$cid:/tmp/pulse-backup.dump" "$dest/database.dump" >/dev/null
docker compose exec -T postgres rm -f /tmp/pulse-backup.dump >/dev/null
tar -czf "$dest/files.tar.gz" -C data/files .
tar -czf "$dest/gateway-state.tar.gz" -C data/gateway .
cp .env server-config.json VERSION.txt "$dest/" 2>/dev/null || true
mkdir -p "$dest/recovery-secrets"; cp secrets/*.txt "$dest/recovery-secrets/"; chmod -R go-rwx "$dest/recovery-secrets"
echo 'Deze backup bevat PULSE recovery-secrets. Bewaar hem privé en versleuteld.' > "$dest/SENSITIVE_BACKUP.txt"
printf '{"version":"0.31.0","createdAt":"%s","database":"pulse","user":"pulse_app","includesSecrets":true}\n' "$(date -Iseconds)" > "$dest/metadata.json"
( cd "$dest" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS.txt )
find backups -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +
echo "Backup voltooid: $dest"
