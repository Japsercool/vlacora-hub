#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; line="0 3 * * * $ROOT/scripts/BACKUP_PULSE_DOCKER.sh >> $ROOT/logs/backup-cron.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'BACKUP_PULSE_DOCKER.sh' || true; echo "$line" ) | crontab -
echo 'Dagelijkse backup om 03:00 toegevoegd aan crontab.'
