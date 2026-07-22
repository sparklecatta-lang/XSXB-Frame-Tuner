param(
  [ValidateSet("full", "lite")]
  [string]$Mode = "full"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js was not found in PATH. Install Node.js 18 or newer first."
  exit 1
}

$target = if ($Mode -eq "lite") {
  @{
    Name = "XSXB Frame Tuner Lite"
    Port = 5180
    Script = "tools\frame_tuner_lite\server.js"
  }
} else {
  @{
    Name = "XSXB Frame Tuner"
    Port = 5179
    Script = "tools\animation_tuner\server.js"
  }
}

# Full and Lite share editing code but use isolated stores. Keep only the mode
# chosen by the user running, and never stop an unrelated process on these ports.
$tunerPattern = "(?:animation_tuner|frame_tuner_lite)[\\/]server\.js"
foreach ($port in @(5179, 5180)) {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($processInfo.CommandLine -match $tunerPattern) {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

$process = Start-Process -FilePath $node.Source `
  -ArgumentList @($target.Script) `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -PassThru

$url = "http://127.0.0.1:$($target.Port)/"
$ready = $false
for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
  if ($process.HasExited) {
    Write-Error "$($target.Name) failed to start."
    exit 1
  }
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 120
  }
}

if (-not $ready) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  Write-Error "$($target.Name) did not become ready at $url"
  exit 1
}

Start-Process $url
Write-Output "$($target.Name) is ready: $url"
