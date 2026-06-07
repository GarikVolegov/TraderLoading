param(
  [string]$TerminalPath = $env:MT5_TERMINAL_PATH
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

python -m pip install -r requirements.txt

$args = @(".\mt5_bridge.py", "--host", "127.0.0.1", "--port", "8765")
if ($TerminalPath) {
  $args += @("--terminal-path", $TerminalPath)
}

python @args
