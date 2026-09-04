# Troubleshooting

## PostgreSQL blijft unhealthy
`docker compose logs postgres --tail 200`

## Gateway unhealthy
`docker compose logs gateway --tail 300` en `scripts/VERIFY_PULSE_DOCKER.*`

## Caddy krijgt geen certificaat
Controleer DNS, poort 80/443, firewall en of een andere service deze poorten gebruikt.

## CORS/origin fout na nieuwe site-URL
Werk PULSE domains bij en gebruik `SET_PULSE_URLS`. Houd oude + nieuwe origin tijdelijk tegelijk toegestaan.

## Migratie stopt op bestanden
De migratie is bewust strict: een niet gekopieerde PULSE-bijlage blokkeert omschakeling. Controleer storage bucket/path en Gateway logs.

## Database bevat al data
Gebruik 'vervang bestaande doeldata' alleen wanneer je bewust een nieuwe finale sync doet. De bron-Supabase blijft rollback.

## Diagnostiek delen
Gebruik `EXPORT_DIAGNOSTICS`; deze bundelt logs en redacted env zonder secretbestanden.
