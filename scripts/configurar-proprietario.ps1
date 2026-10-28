$ErrorActionPreference = 'Stop'
$codigoPrivado = Read-Host 'Informe o código privado do proprietário (não será exibido)' -AsSecureString
$ponteiroPrivado = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($codigoPrivado)
try {
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiroPrivado) | & node (Join-Path $PSScriptRoot 'gerar-hash-proprietario.js')
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar a configuração privada; nenhum servidor foi alterado.' }
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiroPrivado); $codigoPrivado.Dispose() }
