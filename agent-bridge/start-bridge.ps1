$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $env:LOCALAPPDATA 'SuperVoiceAgent'
$BridgeLog = Join-Path $Runtime 'bridge.log'
$BridgeErr = Join-Path $Runtime 'bridge.err.log'
$TunnelLog = Join-Path $Runtime 'tunnel.log'
$TunnelErr = Join-Path $Runtime 'tunnel.err.log'
$EndpointFile = Join-Path $Repo 'voice-chat\bridge-endpoint.json'
$Cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

$TransformersModule = Join-Path $PSScriptRoot 'node_modules\@huggingface\transformers'
if (!(Test-Path $TransformersModule)) {
  Push-Location $PSScriptRoot
  try {
    npm ci --omit=dev | Out-Null
  } finally {
    Pop-Location
  }
}

function Test-Bridge {
  try {
    $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/health' -TimeoutSec 2
    return [bool]$r.ok
  } catch { return $false }
}

function Test-PublicEndpoint {
  try {
    if (!(Test-Path $EndpointFile)) { return $false }
    $u = (Get-Content $EndpointFile -Raw | ConvertFrom-Json).url
    if (!$u) { return $false }
    $r = Invoke-RestMethod -Uri ($u.TrimEnd('/') + '/health') -TimeoutSec 5
    return [bool]$r.ok
  } catch { return $false }
}

if (!(Test-Bridge)) {
  Remove-Item $BridgeLog,$BridgeErr -Force -ErrorAction SilentlyContinue
  Start-Process -WindowStyle Hidden -FilePath 'node.exe' -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $BridgeLog -RedirectStandardError $BridgeErr
  for($i=0;$i -lt 20 -and !(Test-Bridge);$i++){ Start-Sleep -Milliseconds 500 }
  if (!(Test-Bridge)) { throw 'Bridge failed to start.' }
}

if (Test-PublicEndpoint) { exit 0 }

Remove-Item $TunnelLog,$TunnelErr -Force -ErrorAction SilentlyContinue
Start-Process -WindowStyle Hidden -FilePath $Cloudflared -ArgumentList @(
  'tunnel','--url','http://127.0.0.1:8788','--no-autoupdate'
) -RedirectStandardOutput $TunnelLog -RedirectStandardError $TunnelErr

$url = $null
for($i=0;$i -lt 60 -and !$url;$i++){
  Start-Sleep -Milliseconds 500
  foreach($log in @($TunnelLog,$TunnelErr)){
    if(Test-Path $log){
      $logText = Get-Content $log -Raw -ErrorAction SilentlyContinue
      if($logText){
        $m = [regex]::Match([string]$logText,'https://[a-z0-9-]+\.trycloudflare\.com')
        if($m.Success){ $url = $m.Value; break }
      }
    }
  }
}
if(!$url){ throw 'Tunnel URL was not created.' }

$payload = [ordered]@{
  url = $url
  updated_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
} | ConvertTo-Json
Set-Content -Path $EndpointFile -Value $payload -Encoding UTF8

Push-Location $Repo
try {
  git add -- 'voice-chat/bridge-endpoint.json'
  $changed = git diff --cached --name-only
  if($changed){
    git commit -m 'Update agent bridge endpoint'
    git push origin HEAD:main
  }
} finally {
  Pop-Location
}
