param(
  [Parameter(Mandatory = $true)][string]$Instalador,
  [Parameter(Mandatory = $true)][string]$CarpetaInstalada,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$HuellaEsperada
)

$ErrorActionPreference = 'Stop'
$archivos = @(
  $Instalador,
  (Join-Path $CarpetaInstalada 'Comal++.exe'),
  (Join-Path $CarpetaInstalada 'Uninstall Comal++.exe')
)
$correcto = $true
$resultados = foreach ($archivo in $archivos) {
  if (!(Test-Path -LiteralPath $archivo -PathType Leaf)) {
    $correcto = $false
    [pscustomobject]@{ Archivo = $archivo; Aceptado = $false; Motivo = 'Archivo ausente' }
    continue
  }
  $firma = Get-AuthenticodeSignature -LiteralPath $archivo
  $firmante = $firma.SignerCertificate
  $usoFirma = $false
  if ($firmante) {
    $usoFirma = @($firmante.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3' }).Count -gt 0
  }
  $aceptado = $firma.Status -eq 'Valid' -and $firmante -and
    $firmante.Thumbprint -eq $HuellaEsperada -and $usoFirma -and
    $null -ne $firma.TimeStamperCertificate
  if (!$aceptado) { $correcto = $false }
  [pscustomobject]@{
    Archivo = (Resolve-Path -LiteralPath $archivo).Path
    SHA256 = (Get-FileHash -LiteralPath $archivo -Algorithm SHA256).Hash
    Estado = [string]$firma.Status
    Firmante = if ($firmante) { $firmante.Subject } else { $null }
    Huella = if ($firmante) { $firmante.Thumbprint } else { $null }
    UsoFirmaCodigo = $usoFirma
    SelloTiempo = $null -ne $firma.TimeStamperCertificate
    Aceptado = [bool]$aceptado
  }
}
ConvertTo-Json -InputObject @($resultados) -Depth 4
if (!$correcto) { exit 1 }
