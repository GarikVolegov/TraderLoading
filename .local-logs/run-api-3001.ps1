$ErrorActionPreference = "Stop"
Set-Location "c:\Users\osman\Desktop\TraderLoadingsLOCALE"
Get-Content ".env.local" | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $idx = $line.IndexOf("=")
  if ($idx -lt 1) { return }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
  [Environment]::SetEnvironmentVariable($key, $value, "Process")
}
if ($env:LOCAL_DATABASE_URL) { $env:DATABASE_URL = $env:LOCAL_DATABASE_URL }
$env:BASE_PATH = "/"
$env:NODE_ENV = "development"
$env:PORT = "3001"
pnpm.cmd --filter @workspace/api-server exec tsx ./src/index.ts
