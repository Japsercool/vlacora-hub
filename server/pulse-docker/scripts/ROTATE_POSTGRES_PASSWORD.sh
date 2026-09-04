#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
new="$(od -An -N 32 -tx1 /dev/urandom | tr -d ' \n')"
docker compose exec -T postgres psql -U pulse_app -d pulse -v ON_ERROR_STOP=1 -c "alter role pulse_app with password '$new';"
printf '%s' "$new" > secrets/postgres_password.txt; chmod 600 secrets/postgres_password.txt
docker compose up -d --force-recreate gateway
echo 'PostgreSQL-wachtwoord geroteerd.'
