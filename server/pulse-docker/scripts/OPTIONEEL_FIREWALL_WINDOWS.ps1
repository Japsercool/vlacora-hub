param([switch]$Apply)
if(-not $Apply){Write-Host 'Dit script opent TCP 80/443 voor Caddy en maakt GEEN regel voor 5432. Voer opnieuw uit met -Apply.' -ForegroundColor Yellow; exit 0}
New-NetFirewallRule -DisplayName 'PULSE HTTPS 443' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName 'PULSE HTTP ACME 80' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
Write-Host 'Firewallregels 80/443 toegevoegd. PostgreSQL 5432 is niet geopend.' -ForegroundColor Green
