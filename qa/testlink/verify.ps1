$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  $cfg = @{}
  Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { $cfg[$matches[1]] = $matches[2] } }
  $login = Invoke-WebRequest http://127.0.0.1:8090/login.php -SessionVariable session -UseBasicParsing
  $body = @{ tl_login='admin'; tl_password=$cfg.TESTLINK_ADMIN_PASSWORD; reqURI=''; destination='' }
  foreach ($m in [regex]::Matches($login.Content, "name='(CSRFName|CSRFToken)' value='([^']+)'")) { $body[$m.Groups[1].Value] = $m.Groups[2].Value }
  $response = Invoke-WebRequest http://127.0.0.1:8090/login.php -Method Post -Body $body -WebSession $session -UseBasicParsing
  if ($response.Content -notmatch 'index.php\?caller=login') { throw 'Login did not redirect to authenticated index.' }
  $index = Invoke-WebRequest http://127.0.0.1:8090/index.php -WebSession $session -UseBasicParsing
  if ($index.Content -notmatch 'frameset|mainframe|navBar') { throw 'Authenticated index not found.' }
  $xml = '<methodCall><methodName>tl.getProjects</methodName><params><param><value><struct><member><name>devKey</name><value><string>' + $cfg.TESTLINK_API_KEY + '</string></value></member></struct></value></param></params></methodCall>'
  $api = Invoke-WebRequest $cfg.TESTLINK_API_URL -Method Post -ContentType 'text/xml' -Body $xml -UseBasicParsing
  if ($api.Content -match '<fault>' -or $api.Content -notmatch '<methodResponse>') { throw 'XML-RPC response is not valid.' }
  foreach ($path in @('install/index.php','docs/README')) {
    try { Invoke-WebRequest "http://127.0.0.1:8090/$path" -UseBasicParsing | Out-Null; throw "Expected HTTP403 for $path" }
    catch { if ([int]$_.Exception.Response.StatusCode -ne 403) { throw } }
  }
  [ordered]@{checkedAt=(Get-Date).ToString('o'); login='PASS'; authenticatedIndex='PASS'; xmlrpc='PASS'; installAndDocsBlocked='PASS'} | ConvertTo-Json
} finally { Pop-Location }
