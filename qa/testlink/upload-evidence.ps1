param([Parameter(Mandatory=$true)][int]$ExecutionId, [Parameter(Mandatory=$true)][string]$ImagePath)
$ErrorActionPreference = 'Stop'
$cfg = @{}
Get-Content "$PSScriptRoot/.env" | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { $cfg[$matches[1]]=$matches[2] } }
$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ImagePath)))
$members = @{ devKey=$cfg.TESTLINK_API_KEY; executionid=[string]$ExecutionId; title='Selenium evidence'; filename=[IO.Path]::GetFileName($ImagePath); filetype='image/png'; content=$content }
$xml = '<methodCall><methodName>tl.uploadExecutionAttachment</methodName><params><param><value><struct>'
foreach ($k in $members.Keys) { $xml += '<member><name>'+ $k +'</name><value><string>'+[System.Security.SecurityElement]::Escape($members[$k])+'</string></value></member>' }
$xml += '</struct></value></param></params></methodCall>'
$r = Invoke-WebRequest $cfg.TESTLINK_API_URL -Method Post -ContentType 'text/xml' -Body $xml -UseBasicParsing
if ($r.Content -match '<fault>' -or $r.Content -notmatch '<name>file_size</name>') { throw 'Attachment upload failed; inspect server logs.' }
# Response does not contain the developer key.
Write-Output $r.Content
