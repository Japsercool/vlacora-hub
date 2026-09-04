#!/usr/bin/env bash
set -Eeuo pipefail
( crontab -l 2>/dev/null | grep -v 'BACKUP_PULSE_DOCKER.sh' || true ) | crontab -
echo 'PULSE backupplanning verwijderd.'
