param(
  [string]$PulseOrigin = "",
  [string]$SupabaseAuthUrl = "",
  [string]$SupabasePublishableKey = "",
  [string]$GatewayDomain = "",
  [string]$GatewayEmail = "",
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function New-RandomHex([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return (-join ($buffer | ForEach-Object { $_.ToString("x2") }))
}

function Require-Value([string]$Current, [string]$Prompt) {
  if (-not [string]::IsNullOrWhiteSpace($Current)) { return $Current.Trim() }
  do { $v = Read-Host $Prompt } while ([string]::IsNullOrWhiteSpace($v))
  return $v.Trim()
}

Write-Host "" 
Write-Host "PULSE Server 0.30.1 - beheerde Docker-installatie" -ForegroundColor Cyan
Write-Host "PostgreSQL blijft intern in Docker. Alleen de PULSE Data Gateway wordt bereikbaar." -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is niet gevonden. Installeer Docker Desktop/Engine en voer dit script opnieuw uit."
}
$composeVersion = docker compose version 2>$null
if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 is niet beschikbaar." }

$PulseOrigin = Require-Value $PulseOrigin "PULSE website URL/origin (bv. https://pulse.example.be)"
$SupabaseAuthUrl = Require-Value $SupabaseAuthUrl "Supabase Auth URL (https://PROJECT.supabase.co)"
$SupabasePublishableKey = Require-Value $SupabasePublishableKey "Supabase publishable key"

if ([string]::IsNullOrWhiteSpace($GatewayDomain)) {
  $GatewayDomain = Read-Host "Optionele publieke HTTPS gateway-domeinnaam (Enter = alleen poort 8787)"
}
if (-not [string]::IsNullOrWhiteSpace($GatewayDomain) -and [string]::IsNullOrWhiteSpace($GatewayEmail)) {
  $GatewayEmail = Read-Host "E-mail voor automatisch HTTPS-certificaat (Caddy)"
}

New-Item -ItemType Directory -Force -Path "$Root\secrets", "$Root\backups" | Out-Null

$postgresPasswordPath = "$Root\secrets\postgres_password.txt"
$setupTokenPath = "$Root\secrets\gateway_setup_token.txt"
$masterKeyPath = "$Root\secrets\gateway_master_key.txt"

if (-not (Test-Path $postgresPasswordPath)) { Set-Content -NoNewline -Encoding ASCII $postgresPasswordPath (New-RandomHex 32) }
if (-not (Test-Path $setupTokenPath)) { Set-Content -NoNewline -Encoding ASCII $setupTokenPath (New-RandomHex 32) }
if (-not (Test-Path $masterKeyPath)) { Set-Content -NoNewline -Encoding ASCII $masterKeyPath (New-RandomHex 32) }

# Beperk lokale toegang tot secrets zo veel mogelijk. Docker moet ze via de host kunnen mounten.
try {
  icacls "$Root\secrets" /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
} catch {
  Write-Warning "Kon Windows ACL op de secretsmap niet automatisch beperken: $_"
}

$env = @"
PULSE_PUBLIC_URL=$PulseOrigin
PULSE_ALLOWED_ORIGIN=$PulseOrigin
SUPABASE_AUTH_URL=$SupabaseAuthUrl
SUPABASE_PUBLISHABLE_KEY=$SupabasePublishableKey
PULSE_POSTGRES_DB=pulse
PULSE_POSTGRES_USER=pulse_app
PULSE_GATEWAY_PORT=8787
PULSE_GATEWAY_DOMAIN=$GatewayDomain
PULSE_GATEWAY_PUBLIC_URL=$(if ([string]::IsNullOrWhiteSpace($GatewayDomain)) { "" } else { "https://$GatewayDomain" })
PULSE_GATEWAY_EMAIL=$GatewayEmail
PULSE_SOURCE_STORAGE_BUCKET=vlacora-hub-files
"@
Set-Content -Path "$Root\.env" -Value $env -Encoding UTF8

Write-Host "[1/6] Secrets aangemaakt" -ForegroundColor Green
Write-Host "[2/6] Docker-configuratie geschreven" -ForegroundColor Green

if (-not $NoStart) {
  Write-Host "[3/6] Docker images bouwen/starten..." -ForegroundColor Yellow
  if ([string]::IsNullOrWhiteSpace($GatewayDomain)) {
    docker compose up -d --build
  } else {
    docker compose --profile https up -d --build
  }
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose kon PULSE niet starten." }

  Write-Host "[4/6] PostgreSQL healthcheck afwachten..." -ForegroundColor Yellow
  $ok = $false
  for ($i=0; $i -lt 60; $i++) {
    $postgresId = (docker compose ps -q postgres 2>$null).Trim()
    $state = if ($postgresId) { docker inspect --format='{{json .State.Health.Status}}' $postgresId 2>$null } else { "" }
    if ($state -match 'healthy') { $ok = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ok) {
    Write-Warning "PostgreSQL healthcheck is nog niet groen. Controleer met: docker compose ps"
  }

  Write-Host "[5/6] Gateway healthcheck..." -ForegroundColor Yellow
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8787/health" -TimeoutSec 10
    if (-not $health.ok) { throw "Gateway healthcheck gaf geen OK" }
  } catch {
    Write-Warning "Gateway is nog niet bereikbaar op localhost:8787. Controleer met: docker compose logs gateway"
  }
}

$setupToken = (Get-Content $setupTokenPath -Raw).Trim()
$gatewayUrl = if ([string]::IsNullOrWhiteSpace($GatewayDomain)) { "http://<DEZE-SERVER>:8787" } else { "https://$GatewayDomain" }

$pairing = @"
PULSE SERVER KOPPELING
Gateway URL: $gatewayUrl
Setup-code: $setupToken
Database: automatisch beheerde PostgreSQL in Docker
Databasepoort 5432: NIET gepubliceerd
"@
Set-Content -Path "$Root\PULSE_SERVER_KOPPELING.txt" -Value $pairing -Encoding UTF8
try { icacls "$Root\PULSE_SERVER_KOPPELING.txt" /inheritance:r /grant:r "${env:USERNAME}:F" "Administrators:F" | Out-Null } catch {}

Write-Host "[6/6] Klaar" -ForegroundColor Green
Write-Host ""
Write-Host "PULSE-server is voorbereid." -ForegroundColor Cyan
Write-Host "Open Beheer > Database-backend > Beheerde PULSE Docker-server." -ForegroundColor White
Write-Host "Je hoeft GEEN PostgreSQL gebruikersnaam/wachtwoord in PULSE in te vullen." -ForegroundColor Green
Write-Host "Gateway URL: $gatewayUrl" -ForegroundColor Yellow
Write-Host "Setup-code: $setupToken" -ForegroundColor Yellow
Write-Host ""
Write-Host "Deze gegevens staan ook in PULSE_SERVER_KOPPELING.txt. Bewaar de setup-code privé.
De website-URL kun je later in PULSE wijzigen zonder datamigratie. Voor een nieuwe Gateway-domeinnaam gebruik je SET_PULSE_URLS.ps1." -ForegroundColor DarkGray
