$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  if (-not (Test-Path .env)) {
    @(
      'TESTLINK_DB_ROOT_PASSWORD=' + [guid]::NewGuid().ToString('N')
      'TESTLINK_DB_PASSWORD=' + [guid]::NewGuid().ToString('N')
      'TESTLINK_ADMIN_PASSWORD=' + [guid]::NewGuid().ToString('N')
      'TESTLINK_API_KEY=' + [guid]::NewGuid().ToString('N')
      'TESTLINK_API_URL=http://127.0.0.1:8090/lib/api/xmlrpc/v1/xmlrpc.php'
    ) | Set-Content -Encoding ascii .env
  }
  docker compose up -d --wait
  if ($LASTEXITCODE -ne 0) { throw 'Docker services failed to start.' }
  docker compose exec -T testlink php /opt/comal-qa/bootstrap.php
  if ($LASTEXITCODE -ne 0) { throw 'TestLink initialization failed.' }
  Write-Output 'TestLink initialized at http://127.0.0.1:8090 (credentials: local .env).'
} finally { Pop-Location }
