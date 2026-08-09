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

$portableBytes = [IO.File]::ReadAllBytes($portableSource)
if ($portableBytes.Length -lt 256) {
  throw "Portable executable is too small to contain a valid PE header."
}

$peOffset = [BitConverter]::ToInt32($portableBytes, 0x3c)
if ($peOffset -lt 0 -or $peOffset + 94 -gt $portableBytes.Length) {
  throw "Portable executable contains an invalid PE header offset."
}

$peSignature = [Text.Encoding]::ASCII.GetString($portableBytes, $peOffset, 4)
$machine = [BitConverter]::ToUInt16($portableBytes, $peOffset + 4)
$subsystem = [BitConverter]::ToUInt16($portableBytes, $peOffset + 24 + 68)

if ($peSignature -ne "PE`0`0") {
  throw "Portable executable does not contain a valid PE signature."
}
if ($machine -ne 0x8664) {
  throw "Portable executable is not x86-64 (machine: 0x$($machine.ToString('x4')))."
}
if ($subsystem -ne 2) {
  throw "Portable executable is not a Windows GUI application (subsystem: $subsystem)."
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

$checksumLines = @(Get-ChildItem -LiteralPath $releaseDirectory -Filter "*.exe" -File |
  Sort-Object Name |
  Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_.Path))" })

$checksumContent = ($checksumLines -join "`n") + "`n"
$checksumPath = Join-Path $releaseDirectory "SHA256SUMS.txt"
[IO.File]::WriteAllText($checksumPath, $checksumContent, [Text.UTF8Encoding]::new($false))

Write-Host "Assembled Desktop Pet $Version release files in $releaseDirectory"
