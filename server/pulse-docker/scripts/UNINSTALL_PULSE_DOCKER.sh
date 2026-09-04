#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
if [[ "${1:-}" == '--remove-data' ]]; then read -r -p 'Typ VERWIJDER ALLE PULSE DATA: ' a; [[ "$a" == 'VERWIJDER ALLE PULSE DATA' ]] || exit 1; docker compose down -v --remove-orphans; else docker compose down --remove-orphans; fi
