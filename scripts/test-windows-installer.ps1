param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = "Stop"

function Wait-ForRemoval([string]$Path) {
  $deadline = [DateTime]::UtcNow.AddSeconds(10)

  while ((Test-Path -LiteralPath $Path) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
}

if (-not $IsWindows) {
  throw "The installer smoke test must run on Windows."
}
if (-not $env:RUNNER_TEMP) {
  throw "RUNNER_TEMP is required so the smoke installation stays isolated."
}

$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $resolvedInstaller -PathType Leaf)) {
  throw "NSIS installer does not exist: $resolvedInstaller"
}

$runnerTemp = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar)
$installDirectory = [IO.Path]::GetFullPath(
  (Join-Path $runnerTemp "desktop-pet-installer-smoke-$([Guid]::NewGuid().ToString('N'))")
)
$installParent = [IO.Path]::GetDirectoryName($installDirectory)

if ($installParent -ne $runnerTemp) {
  throw "Refusing to use a smoke-test directory outside RUNNER_TEMP: $installDirectory"
}
if (Test-Path -LiteralPath $installDirectory) {
  throw "Smoke-test installation directory already exists: $installDirectory"
}

$productName = "桌面小怪兽"
$mainExecutable = Join-Path $installDirectory "desktop-pet.exe"
$uninstaller = Join-Path $installDirectory "uninstall.exe"
$uninstallRegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$productName"
$startMenuShortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$productName.lnk"

Write-Host "Silently installing into isolated directory: $installDirectory"
$installProcess = Start-Process -FilePath $resolvedInstaller -ArgumentList @(
  "/S",
  "/D=$installDirectory"
) -Wait -PassThru
if ($installProcess.ExitCode -ne 0) {
  throw "NSIS installer exited with code $($installProcess.ExitCode)."
}

if (-not (Test-Path -LiteralPath $mainExecutable -PathType Leaf)) {
  throw "Installed main executable was not found: $mainExecutable"
}
if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
  throw "Installed uninstaller was not found: $uninstaller"
}
if (-not (Test-Path -LiteralPath $uninstallRegistryPath)) {
  throw "Current-user uninstall registry entry was not created."
}

$registeredLocation = (Get-ItemProperty -LiteralPath $uninstallRegistryPath -Name InstallLocation).InstallLocation.Trim('"')
if ([IO.Path]::GetFullPath($registeredLocation) -ne $installDirectory) {
  throw "Registered install location does not match the isolated directory: $registeredLocation"
}
if (-not (Test-Path -LiteralPath $startMenuShortcut -PathType Leaf)) {
  throw "Start menu shortcut was not created: $startMenuShortcut"
}

Write-Host "Silently uninstalling the isolated installation."
$uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
if ($uninstallProcess.ExitCode -ne 0) {
  throw "NSIS uninstaller exited with code $($uninstallProcess.ExitCode)."
}

Wait-ForRemoval $mainExecutable
Wait-ForRemoval $uninstallRegistryPath
Wait-ForRemoval $startMenuShortcut
Wait-ForRemoval $installDirectory

if (Test-Path -LiteralPath $mainExecutable) {
  throw "Main executable remains after uninstall: $mainExecutable"
}
if (Test-Path -LiteralPath $uninstallRegistryPath) {
  throw "Current-user uninstall registry entry remains after uninstall."
}
if (Test-Path -LiteralPath $startMenuShortcut) {
  throw "Start menu shortcut remains after uninstall: $startMenuShortcut"
}
if (Test-Path -LiteralPath $installDirectory) {
  throw "Installation directory remains after uninstall: $installDirectory"
}

Write-Host "NSIS isolated install/uninstall smoke test passed."
