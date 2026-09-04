param([Parameter(Mandatory=$true)][string]$WebAppPath)
$ErrorActionPreference='Stop'; $root=(Resolve-Path $WebAppPath).Path
$files=Get-ChildItem $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.mjs -ErrorAction SilentlyContinue | Where-Object {$_.FullName -notmatch '\\node_modules\\|\\.next\\|\\dist\\'}
$patterns=[ordered]@{'Direct Supabase data'= '\.from\s*\('; 'Supabase Storage'='\.storage\.'; 'Hardcoded vercel.app'='vercel\.app'; 'Hardcoded localhost'='https?://localhost'}
$blocking=0
foreach($p in $patterns.GetEnumerator()){$hits=$files|Select-String -Pattern $p.Value; Write-Host "`n$($p.Key): $($hits.Count)" -ForegroundColor Cyan; $hits|Select-Object -First 50|ForEach-Object{Write-Host "$($_.Path):$($_.LineNumber) $($_.Line.Trim())"}; if($p.Key -in @('Direct Supabase data','Supabase Storage') -and $hits.Count -gt 0){$blocking += $hits.Count}}
if($blocking -gt 0){Write-Host "`nGO-LIVE BLOKKER: $blocking directe data/storage-aanroep(en) gevonden. Deze moeten via de centrale PULSE datalaag voor de definitieve switch." -ForegroundColor Red; exit 2}else{Write-Host '`nGeen directe Supabase data/storage calls gevonden door deze audit.' -ForegroundColor Green}
