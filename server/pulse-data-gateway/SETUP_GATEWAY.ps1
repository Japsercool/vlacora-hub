$ErrorActionPreference = "Stop"

function New-Hex([int]$Bytes) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (-join ($b | ForEach-Object { $_.ToString("x2") }))
}

Write-Host "PULSE Data Gateway 0.29 setup" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is niet gevonden. Installeer Node.js 22 LTS of nieuwer."
}

$authUrl = Read-Host "Supabase Auth URL (https://PROJECT.supabase.co)"
$publishable = Read-Host "Supabase publishable key"
$origin = Read-Host "PULSE website origin (bv. https://pulse.example.be)"
$fileRoot = Read-Host "Lokale PULSE bestandenmap (bv. D:\PULSE\Data\Files)"
if ([string]::IsNullOrWhiteSpace($fileRoot)) { $fileRoot = "D:\PULSE\Data\Files" }

$setupToken = New-Hex 32
$masterKey = New-Hex 32

$envText = @"
PORT=8787
PULSE_ALLOWED_ORIGIN=$origin
SUPABASE_AUTH_URL=$authUrl
SUPABASE_PUBLISHABLE_KEY=$publishable
PULSE_GATEWAY_SETUP_TOKEN=$setupToken
PULSE_GATEWAY_MASTER_KEY=$masterKey
PULSE_FILE_ROOT=$fileRoot
PULSE_SOURCE_STORAGE_BUCKET=vlacora-hub-files
PULSE_FILE_MIGRATION_STRICT=1
PULSE_POSTGRES_ALLOW_SELF_SIGNED=0
"@

Set-Content -Path ".env" -Value $envText -Encoding UTF8
New-Item -ItemType Directory -Force -Path $fileRoot | Out-Null

Write-Host "Dependencies installeren..." -ForegroundColor Yellow
npm install
npm run check

Write-Host "" 
Write-Host "Gateway configuratie is aangemaakt." -ForegroundColor Green
Write-Host "Setup-token (nodig in Beheer > Database-backend):" -ForegroundColor Yellow
Write-Host $setupToken
Write-Host "" 
Write-Host "De master key staat alleen in .env. Maak van .env een beveiligde serverbackup en commit hem NOOIT naar Git." -ForegroundColor Yellow
Write-Host "Start daarna met: npm start" -ForegroundColor Cyan
