param(
    [string]$EspeakPath,
    [switch]$PrepareEngine
)

$ErrorActionPreference = 'Stop'
$comalProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$comalWork = Join-Path $comalProject '.tmp-audio'

# Generation is a build-time task. The application only plays the committed WAVs.
# Windows is not modified: the optional engine download is extracted into this project.
if ($PrepareEngine) {
    $comalArchive = Join-Path $comalWork 'espeak-ng.msi'
    $comalExtracted = Join-Path $comalWork 'espeak'
    $comalRuntime = Join-Path $comalWork 'runtime'
    $comalSevenZip = Join-Path $env:ProgramFiles '7-Zip\7z.exe'
    if (-not (Test-Path -LiteralPath $comalSevenZip)) {
        throw '7-Zip is required for extraction. Alternatively pass -EspeakPath with an existing eSpeak NG executable.'
    }
    New-Item -ItemType Directory -Path $comalWork -Force | Out-Null
    if (-not (Test-Path -LiteralPath $comalArchive)) {
        Invoke-WebRequest -Uri 'https://github.com/espeak-ng/espeak-ng/releases/download/1.52.0/espeak-ng.msi' -OutFile $comalArchive
    }
    $comalExpectedHash = '7F673C709EA5DD579D3B5EBB98688CC575328A6AB7438D2BC405B88CEDAEAFB9'
    if ((Get-FileHash -LiteralPath $comalArchive -Algorithm SHA256).Hash -ne $comalExpectedHash) {
        throw 'The eSpeak NG archive SHA-256 does not match the pinned 1.52.0 package.'
    }
    & $comalSevenZip x $comalArchive "-o$comalExtracted" '-y' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot extract the eSpeak NG package.' }
    # 7-Zip expands the MSI cabinet with internal IDs as filenames. Read its
    # read-only directory/file tables to restore paths without running an installer.
    $comalInstaller = New-Object -ComObject WindowsInstaller.Installer
    $comalDatabase = $comalInstaller.OpenDatabase($comalArchive, 0)
    $comalDirectories = @{}
    $comalComponents = @{}
    $comalView = $comalDatabase.OpenView('SELECT `Directory`, `Directory_Parent`, `DefaultDir` FROM `Directory`')
    $comalView.Execute()
    while ($comalRecord = $comalView.Fetch()) {
        $comalDirectories[$comalRecord.StringData(1)] = @($comalRecord.StringData(2), ($comalRecord.StringData(3).Split('|')[-1]).Trim())
    }
    function Resolve-ComalEngineDirectory([string]$DirectoryId) {
        if ($DirectoryId -eq 'INSTALLDIR') { return $comalRuntime }
        $comalDirectory = $comalDirectories[$DirectoryId]
        return Join-Path (Resolve-ComalEngineDirectory $comalDirectory[0]) $comalDirectory[1]
    }
    $comalView = $comalDatabase.OpenView('SELECT `Component`, `Directory_` FROM `Component`')
    $comalView.Execute()
    while ($comalRecord = $comalView.Fetch()) { $comalComponents[$comalRecord.StringData(1)] = $comalRecord.StringData(2) }
    $comalView = $comalDatabase.OpenView('SELECT `File`, `Component_`, `FileName` FROM `File`')
    $comalView.Execute()
    while ($comalRecord = $comalView.Fetch()) {
        $comalDirectory = Resolve-ComalEngineDirectory $comalComponents[$comalRecord.StringData(2)]
        New-Item -ItemType Directory -Path $comalDirectory -Force | Out-Null
        $comalFileName = ($comalRecord.StringData(3).Split('|')[-1]).Trim()
        Copy-Item -LiteralPath (Join-Path $comalExtracted $comalRecord.StringData(1)) -Destination (Join-Path $comalDirectory $comalFileName)
    }
    $EspeakPath = Join-Path $comalRuntime 'espeak-ng.exe'
}

if (-not $EspeakPath) {
    $comalInstalled = Get-Command 'espeak-ng' -ErrorAction SilentlyContinue
    if ($comalInstalled) { $EspeakPath = $comalInstalled.Source }
    else { throw 'Pass -EspeakPath or -PrepareEngine to generate audio. Regeneration is unnecessary for normal use.' }
}

$comalVoiceRoot = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($EspeakPath))
$comalOutput = Join-Path $comalProject 'contenido\voz'
New-Item -ItemType Directory -Path $comalOutput -Force | Out-Null

function Get-ComalSpanishNumber([int]$number) {
    $comalSmall = @('', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve')
    $comalTens = @('', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa')
    if ($number -eq 0) { return 'cero cero' }
    if ($number -lt 30) { return $comalSmall[$number] }
    $comalText = $comalTens[[math]::Floor($number / 10)]
    if ($number % 10 -ne 0) { $comalText += ' y ' + $comalSmall[$number % 10] }
    return $comalText
}

function Write-ComalSpeech([string]$RelativePath, [string]$Speech) {
    $comalTarget = Join-Path $comalOutput $RelativePath
    & $EspeakPath "--path=$comalVoiceRoot" '-v' 'es-419' '-s' '145' '-p' '45' '-a' '140' '-w' $comalTarget $Speech
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $comalTarget)) { throw "Cannot synthesize $RelativePath" }
    if ((Get-Item -LiteralPath $comalTarget).Length -lt 4096) { throw "Generated audio is unexpectedly short: $RelativePath" }
}

# Con dos dígitos el catálogo completo son 100 frases (arquitectura §7): 00 a 99, sin concatenar.
for ($comalNumber = 0; $comalNumber -le 99; $comalNumber++) {
    $comalCode = $comalNumber.ToString('00')
    Write-ComalSpeech "$comalCode.wav" ('Turno ' + (Get-ComalSpanishNumber $comalNumber) + '.')
}
Write-Output 'Generated 100 Spanish turn announcements (00-99) in contenido/voz. Run node tooling/audio/verify-audio.mjs to verify.'
