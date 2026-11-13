param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$Huella
)
$ErrorActionPreference = 'Stop'
$certificado = Get-Item -LiteralPath "Cert:\CurrentUser\My\$Huella"
if (!$certificado.HasPrivateKey) { throw 'El certificado no tiene clave privada.' }
$ahora = Get-Date
if ($ahora -lt $certificado.NotBefore -or $ahora -ge $certificado.NotAfter) {
  throw 'El certificado no esta vigente.'
}
if (!(@($certificado.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq '1.3.6.1.5.5.7.3.3' }).Count)) {
  throw 'El certificado no autoriza firma de codigo.'
}
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($certificado)
try {
  if ($rsa -isnot [System.Security.Cryptography.RSACng] -or
      $rsa.Key.Provider.Provider -ne 'Microsoft Platform Crypto Provider' -or
      $rsa.Key.ExportPolicy -ne [System.Security.Cryptography.CngExportPolicies]::None) {
    throw 'Se requiere una clave RSA no exportable protegida por TPM.'
  }
} finally {
  if ($rsa) { $rsa.Dispose() }
}
