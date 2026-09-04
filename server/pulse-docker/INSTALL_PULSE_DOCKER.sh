#!/usr/bin/env bash
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/scripts/INSTALL_PULSE_DOCKER.sh" "$@"
