param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$')]
  [string]$Version,

  [string]$OutputDirectory = "release"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDirectory = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
$portableSource = Join-Path $projectRoot "src-tauri/target/release/desktop-pet.exe"
$installerDirectory = Join-Path $projectRoot "src-tauri/target/release/bundle/nsis"

if (-not (Test-Path -LiteralPath $portableSource -PathType Leaf)) {
  throw "Portable executable was not produced: $portableSource"
}

if (-not (Test-Path -LiteralPath $installerDirectory -PathType Container)) {
  throw "NSIS output directory was not produced: $installerDirectory"
}

$installers = @(Get-ChildItem -LiteralPath $installerDirectory -Filter "*.exe" -File)
if ($installers.Count -ne 1) {
  throw "Expected exactly one NSIS installer, found $($installers.Count)."
}

if (Test-Path -LiteralPath $releaseDirectory) {
  $existingFiles = @(Get-ChildItem -LiteralPath $releaseDirectory -Force)
  if ($existingFiles.Count -ne 0) {
    throw "Release output directory is not empty: $releaseDirectory"
  }
} else {
  New-Item -ItemType Directory -Path $releaseDirectory | Out-Null
}

Copy-Item -LiteralPath $portableSource -Destination (Join-Path $releaseDirectory "Desktop-Pet_${Version}_x64-portable.exe")
Copy-Item -LiteralPath $installers[0].FullName -Destination (Join-Path $releaseDirectory "Desktop-Pet_${Version}_x64-setup.exe")

Get-ChildItem -LiteralPath $releaseDirectory -Filter "*.exe" -File |
  Sort-Object Name |
  Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" } |
  Set-Content -LiteralPath (Join-Path $releaseDirectory "SHA256SUMS.txt") -Encoding ascii

Write-Host "Assembled Desktop Pet $Version release files in $releaseDirectory"
