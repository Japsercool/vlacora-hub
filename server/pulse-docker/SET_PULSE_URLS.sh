#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
[ -f .env ] || { echo ".env ontbreekt. Voer eerst INSTALL_PULSE_DOCKER.sh uit."; exit 1; }

printf "Nieuwe PULSE website URL: "
read -r PULSE_PUBLIC_URL
case "$PULSE_PUBLIC_URL" in http://*|https://*) ;; *) echo "URL moet met http:// of https:// beginnen."; exit 1;; esac
printf "Nieuwe Gateway domeinnaam (Enter = huidige behouden): "
read -r NEW_DOMAIN || true

setenv() {
  key="$1"; value="$2"
  if grep -q "^${key}=" .env; then
    tmp=".env.tmp.$$"; awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' .env > "$tmp"; mv "$tmp" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

PULSE_PUBLIC_URL=${PULSE_PUBLIC_URL%/}
setenv PULSE_PUBLIC_URL "$PULSE_PUBLIC_URL"
setenv PULSE_ALLOWED_ORIGIN "$PULSE_PUBLIC_URL"
if [ -n "${NEW_DOMAIN:-}" ]; then
  NEW_DOMAIN=$(printf '%s' "$NEW_DOMAIN" | sed -E 's#^https?://##;s#/.*$##')
  setenv PULSE_GATEWAY_DOMAIN "$NEW_DOMAIN"
  setenv PULSE_GATEWAY_PUBLIC_URL "https://$NEW_DOMAIN"
  docker compose --profile https up -d --build gateway caddy
else
  docker compose up -d --build gateway
fi

echo "Klaar. Geen database- of gebruikersmigratie uitgevoerd."
echo "Supabase Auth redirect toevoegen: $PULSE_PUBLIC_URL/auth/callback"
