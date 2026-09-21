param(
    [string]$Python,
    [string]$Voice = 'es_MX-claude-high',
    # Piper's neural pacing is already conversational; raise it to stretch the phrase if
    # the room is noisy. It is sub-linear: 1.2 buys about 7% more length, not 20%.
    [double]$LengthScale = 1.0,
    # Matches the loudness of the eSpeak-era catalogue (mean RMS 0.107) so an installed
    # turnero keeps its volume setting, while the raw output still leaves ~3 dB headroom.
    [double]$Volume = 1.2
)

$ErrorActionPreference = 'Stop'
$comalProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$comalWork = Join-Path $comalProject '.tmp-audio'
$comalVenv = Join-Path $comalWork 'piper-venv'
$comalVenvPython = Join-Path $comalVenv 'Scripts\python.exe'
$comalVoices = Join-Path $comalWork 'piper-voices'
$comalOutput = Join-Path $comalProject 'contenido\voz'

# Generation is a build-time task. The application only plays the committed WAVs, so
# neither Piper nor Python reach the installer (RNF-01). Everything below lives inside
# .tmp-audio/, which is git-ignored: Windows is never modified. Only the first run
# needs internet, and each step is skipped once its artifact is in place.
if (-not (Test-Path -LiteralPath $comalVenvPython)) {
    if (-not $Python) {
        $comalInterpreter = Get-Command 'python' -ErrorAction SilentlyContinue
        if (-not $comalInterpreter) { throw 'Python 3 is required to regenerate audio. Pass -Python with an interpreter path.' }
        $Python = $comalInterpreter.Source
    }
    & $Python -m venv $comalVenv
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $comalVenvPython)) { throw 'Cannot create the Python virtual environment.' }
}

& $comalVenvPython -m pip show piper-tts *> $null
if ($LASTEXITCODE -ne 0) {
    & $comalVenvPython -m pip install --quiet --disable-pip-version-check 'piper-tts==1.8.0'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot install piper-tts. The first run needs internet.' }
}

$comalModel = Join-Path $comalVoices "$Voice.onnx"
if (-not (Test-Path -LiteralPath $comalModel)) {
    & $comalVenvPython -m piper.download_voices $Voice --data-dir $comalVoices
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $comalModel)) { throw "Cannot download the voice $Voice." }
}

function Get-ComalSpanishNumber([int]$number) {
    $comalSmall = @('', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve')
    $comalTens = @('', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa')
    if ($number -eq 0) { return 'cero cero' }
    if ($number -lt 30) { return $comalSmall[$number] }
    $comalText = $comalTens[[math]::Floor($number / 10)]
    if ($number % 10 -ne 0) { $comalText += ' y ' + $comalSmall[$number % 10] }
    return $comalText
}

# Con dos dígitos el catálogo completo son 100 frases (arquitectura §7): 00 a 99, sin concatenar.
$comalRequests = @(0..99 | ForEach-Object {
        [pscustomobject]@{ file = $_.ToString('00') + '.wav'; text = 'Turno ' + (Get-ComalSpanishNumber $_) + '.' }
    })

New-Item -ItemType Directory -Path $comalOutput -Force | Out-Null
$comalRequestFile = Join-Path $comalWork 'announcements.json'
$comalRequests | ConvertTo-Json | Set-Content -LiteralPath $comalRequestFile -Encoding utf8NoBOM

& $comalVenvPython (Join-Path $PSScriptRoot 'synthesize.py') `
    --model $comalModel `
    --requests $comalRequestFile `
    --output-dir $comalOutput `
    --length-scale $LengthScale `
    --volume $Volume
if ($LASTEXITCODE -ne 0) { throw 'Piper synthesis failed.' }

$comalWritten = (Get-ChildItem -LiteralPath $comalOutput -Filter '*.wav').Count
Write-Output "Generated $comalWritten Spanish turn announcements (00-99) in contenido/voz with $Voice. Run node tooling/audio/verify-audio.mjs to verify."
