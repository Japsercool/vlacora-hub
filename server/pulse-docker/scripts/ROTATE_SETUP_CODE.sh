#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
od -An -N 32 -tx1 /dev/urandom | tr -d ' \n' > secrets/gateway_setup_token.txt; chmod 600 secrets/gateway_setup_token.txt
docker compose up -d --force-recreate gateway
echo "Nieuwe setup-code: $(cat secrets/gateway_setup_token.txt)"
