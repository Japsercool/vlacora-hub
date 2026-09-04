#!/usr/bin/env bash
set -Eeuo pipefail
[[ $# -ge 1 ]] || { echo "Gebruik: $0 /pad/naar/pulse-webapp"; exit 2; }
root="$1"; echo 'Direct Supabase data calls:'; grep -RInE '\.from[[:space:]]*\(' "$root" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=.next || true
echo 'Supabase Storage calls:'; grep -RInE '\.storage\.' "$root" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=.next || true
echo 'Hardcoded URLs:'; grep -RInE 'vercel\.app|https?://localhost' "$root" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --exclude-dir=node_modules --exclude-dir=.next || true
