$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$releaseDir = Join-Path $root "release"
$zipPath = Join-Path $releaseDir "nuqta-khadra-web.zip"

if (-not (Test-Path $dist)) {
  throw "dist folder not found. Run npm run build first."
}

if (-not (Test-Path $releaseDir)) {
  New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "Created: $zipPath"
