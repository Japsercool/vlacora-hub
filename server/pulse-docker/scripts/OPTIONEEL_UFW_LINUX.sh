#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == '--apply' ]] || { echo 'Dit script opent 80/tcp en 443/tcp in UFW. Het opent 5432 NIET. Gebruik --apply.'; exit 0; }
sudo ufw allow 80/tcp comment 'PULSE Caddy ACME'; sudo ufw allow 443/tcp comment 'PULSE HTTPS'; sudo ufw status
echo 'PostgreSQL 5432 is niet geopend.'
