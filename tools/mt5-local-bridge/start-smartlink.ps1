param(
  [Parameter(Mandatory = $true)]
  [string]$ProfileId,

  [string]$ApiBase = "http://127.0.0.1:3001/api/brokers",
  [string]$TerminalPath = $env:MT5_TERMINAL_PATH,
  [string]$Login,
  [string]$Server,
  [string]$Password
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

python -m pip install -r requirements.txt

$args = @(
  ".\mt5_bridge.py",
  "--smartlink-api", $ApiBase,
  "--profile-id", $ProfileId,
  "--token", "smartlink"
)

if ($TerminalPath) {
  $args += @("--terminal-path", $TerminalPath)
}
if ($Login) {
  $args += @("--login", $Login)
}
if ($Server) {
  $args += @("--server", $Server)
}
if ($Password) {
  $args += @("--password", $Password)
}

python @args
