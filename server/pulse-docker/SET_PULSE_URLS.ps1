param(
  [string]$PulseOrigin = "",
  [string]$GatewayDomain = "",
  [string]$GatewayEmail = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$EnvFile = Join-Path $Root ".env"
if (-not (Test-Path $EnvFile)) { throw ".env ontbreekt. Voer eerst INSTALL_PULSE_DOCKER.ps1 uit." }

function Ask([string]$Value,[string]$Prompt) {
  if (-not [string]::IsNullOrWhiteSpace($Value)) { return $Value.Trim() }
  return (Read-Host $Prompt).Trim()
}
function Set-EnvValue([string]$Name,[string]$Value) {
  $lines = @(Get-Content $EnvFile)
  $escaped = [regex]::Escape($Name)
  $found = $false
  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$escaped=") { $lines[$i] = "$Name=$Value"; $found=$true }
  }
  if (-not $found) { $lines += "$Name=$Value" }
  Set-Content -Path $EnvFile -Value $lines -Encoding UTF8
}

Write-Host ""; Write-Host "PULSE URL-wijziging" -ForegroundColor Cyan
$PulseOrigin = Ask $PulseOrigin "Nieuwe PULSE website URL (bv. https://pulse.jouwdomein.be)"
if ($PulseOrigin -notmatch '^https?://') { throw "Website URL moet met http:// of https:// beginnen." }
if ([string]::IsNullOrWhiteSpace($GatewayDomain)) {
  $GatewayDomain = (Read-Host "Nieuwe Gateway domeinnaam (Enter = huidige behouden)").Trim()
}
if (-not [string]::IsNullOrWhiteSpace($GatewayDomain)) {
  $GatewayDomain = $GatewayDomain -replace '^https?://','' -replace '/.*$',''
  if ([string]::IsNullOrWhiteSpace($GatewayEmail)) { $GatewayEmail = (Read-Host "E-mail voor HTTPS-certificaat (Enter = huidige behouden)").Trim() }
}

Set-EnvValue "PULSE_PUBLIC_URL" ($PulseOrigin.TrimEnd('/'))
Set-EnvValue "PULSE_ALLOWED_ORIGIN" ($PulseOrigin.TrimEnd('/'))
if (-not [string]::IsNullOrWhiteSpace($GatewayDomain)) {
  Set-EnvValue "PULSE_GATEWAY_DOMAIN" $GatewayDomain
  Set-EnvValue "PULSE_GATEWAY_PUBLIC_URL" "https://$GatewayDomain"
  if (-not [string]::IsNullOrWhiteSpace($GatewayEmail)) { Set-EnvValue "PULSE_GATEWAY_EMAIL" $GatewayEmail }
}

Write-Host "Gateway opnieuw laden; volumes en PostgreSQL-data blijven intact..." -ForegroundColor Yellow
if ([string]::IsNullOrWhiteSpace($GatewayDomain)) {
  docker compose up -d --build gateway
} else {
  docker compose --profile https up -d --build gateway caddy
}
if ($LASTEXITCODE -ne 0) { throw "Docker kon de URL-configuratie niet toepassen." }

Write-Host ""; Write-Host "Klaar." -ForegroundColor Green
Write-Host "Nieuwe PULSE website: $PulseOrigin"
if ($GatewayDomain) { Write-Host "Gateway: https://$GatewayDomain" }
Write-Host "Geen database- of gebruikersmigratie uitgevoerd." -ForegroundColor DarkGray
Write-Host "Voeg bij Supabase Auth ook toe als redirect URL: $($PulseOrigin.TrimEnd('/'))/auth/callback" -ForegroundColor Yellow
