# Installatie stap voor stap

## Voorwaarden
- Docker Engine/Desktop met Compose v2;
- voldoende vrije schijfruimte;
- voor publieke productie: DNS-record voor Gateway en inkomend 80/443;
- PULSE website-URL;
- Supabase project URL en publishable key.

## Wat jij niet hoeft te maken
Je maakt **geen PostgreSQL-gebruiker, database, wachtwoord, Docker-netwerk of volumenamen**. De installer doet dat.

## Mappen
De installer maakt `secrets`, `data/files`, `data/gateway`, `backups` en `logs`. PostgreSQL zelf gebruikt een beheerd Docker volume `pulse_postgres`.

## Secrets
`postgres_password.txt`, `gateway_setup_token.txt` en `gateway_master_key.txt` worden cryptografisch random gegenereerd. Ze mogen nooit naar GitHub.
