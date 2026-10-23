$ErrorActionPreference = 'Stop'
$pasta = Join-Path $env:USERPROFILE '.nutrifoto/assinatura'
$chave = Join-Path $pasta 'nutrifoto-release.p12'
$propriedades = Join-Path $pasta 'release.properties'
if ((Test-Path $chave) -and (Test-Path $propriedades)) { Write-Output "Assinatura existente preservada em $pasta"; exit 0 }
if ((Test-Path $chave) -or (Test-Path $propriedades)) { throw 'Assinatura incompleta. Nenhuma chave foi substituída; recupere o backup privado.' }
New-Item -ItemType Directory -Force $pasta | Out-Null
$conta = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $pasta '/inheritance:r' '/grant:r' "${conta}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível restringir o acesso à assinatura.' }
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:NUTRIFOTO_SENHA_ASSINATURA = [Convert]::ToBase64String($bytes)
$keytool = Join-Path $env:USERPROFILE '.nutrifoto/android/jdk/bin/keytool.exe'
try {
    & $keytool -genkeypair -keystore $chave -storetype PKCS12 -alias nutrifoto-release -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=NutriFoto,C=BR' -storepass:env NUTRIFOTO_SENHA_ASSINATURA -keypass:env NUTRIFOTO_SENHA_ASSINATURA
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar a assinatura.' }
    $conteudo = 'storeFile=' + $chave.Replace('\','/') + "`nkeyAlias=nutrifoto-release`nstorePassword=" + $env:NUTRIFOTO_SENHA_ASSINATURA + "`nkeyPassword=" + $env:NUTRIFOTO_SENHA_ASSINATURA + "`n"
    [IO.File]::WriteAllText($propriedades, $conteudo, [Text.UTF8Encoding]::new($false))
    Write-Output "Assinatura criada em $pasta. Faça backup privado dos dois arquivos; não inclua no Git."
} finally { Remove-Item Env:NUTRIFOTO_SENHA_ASSINATURA -ErrorAction SilentlyContinue }
