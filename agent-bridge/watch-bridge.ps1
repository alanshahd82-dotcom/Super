$ErrorActionPreference = 'Continue'
$Starter = Join-Path $PSScriptRoot 'start-bridge.ps1'
while($true){
  try {
    powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $Starter | Out-Null
  } catch {}
  Start-Sleep -Seconds 60
}
