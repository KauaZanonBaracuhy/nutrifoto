$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$pastaFerramentas = Join-Path $env:USERPROFILE '.nutrifoto/android'
New-Item -ItemType Directory -Force -Path $pastaFerramentas | Out-Null
function Baixar-Arquivo($endereco, $destino) {
    if (!(Test-Path -LiteralPath $destino)) { Invoke-WebRequest -UseBasicParsing -Uri $endereco -OutFile $destino }
}
if (!(Test-Path (Join-Path $pastaFerramentas 'jdk/bin/java.exe'))) {
    $versoes = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
    $pacote = $versoes[0].binary.package
    $arquivoJdk = Join-Path $pastaFerramentas 'jdk21.zip'
    Baixar-Arquivo $pacote.link $arquivoJdk
    if ((Get-FileHash $arquivoJdk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pacote.checksum) { throw 'Checksum do JDK incorreto.' }
    $extracao = Join-Path $pastaFerramentas 'jdk-extraido'
    Expand-Archive -LiteralPath $arquivoJdk -DestinationPath $extracao -Force
    $origemJdk = (Get-ChildItem $extracao -Directory | Select-Object -First 1).FullName
    Copy-Item -LiteralPath $origemJdk -Destination (Join-Path $pastaFerramentas 'jdk') -Recurse
}
$env:JAVA_HOME = Join-Path $pastaFerramentas 'jdk'
$env:ANDROID_HOME = Join-Path $pastaFerramentas 'sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
$gerenciadorSdk = Join-Path $env:ANDROID_HOME 'cmdline-tools/19.0/bin/sdkmanager.bat'
if (!(Test-Path -LiteralPath $gerenciadorSdk)) {
    [xml]$repositorio = (Invoke-WebRequest -UseBasicParsing 'https://dl.google.com/android/repository/repository2-3.xml').Content
    $pacote = $repositorio.SelectSingleNode("//*[local-name()='remotePackage' and @path='cmdline-tools;19.0']")
    $arquivo = $pacote.archives.archive | Where-Object { $_.'host-os' -eq 'windows' } | Select-Object -First 1
    if (!$arquivo) { throw 'Pacote Windows do SDK não encontrado no repositório oficial.' }
    $arquivoSdk = Join-Path $pastaFerramentas 'cmdline-tools-19.zip'
    Baixar-Arquivo ('https://dl.google.com/android/repository/' + $arquivo.complete.url) $arquivoSdk
    $algoritmo = $arquivo.complete.checksum.type.ToUpperInvariant()
    if ((Get-FileHash $arquivoSdk -Algorithm $algoritmo).Hash.ToLowerInvariant() -ne $arquivo.complete.checksum.InnerText.Trim()) { throw 'Checksum das ferramentas Android incorreto.' }
    $extracao = Join-Path $pastaFerramentas 'sdk-extraido-19'
    Expand-Archive -LiteralPath $arquivoSdk -DestinationPath $extracao -Force
    New-Item -ItemType Directory -Force (Join-Path $env:ANDROID_HOME 'cmdline-tools') | Out-Null
    Copy-Item -LiteralPath (Join-Path $extracao 'cmdline-tools') -Destination (Join-Path $env:ANDROID_HOME 'cmdline-tools/19.0') -Recurse
}
1..100 | ForEach-Object { 'y' } | & $gerenciadorSdk --licenses "--sdk_root=$env:ANDROID_HOME"
& $gerenciadorSdk --install 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'emulator' 'system-images;android-36;google_apis;x86_64' "--sdk_root=$env:ANDROID_HOME"
if ($LASTEXITCODE -ne 0) { throw 'Instalação do SDK Android falhou.' }
foreach ($item in @('platforms/android-36/android.jar','build-tools/36.0.0/apksigner.bat','system-images/android-36/google_apis/x86_64/system.img')) {
    if (!(Test-Path (Join-Path $env:ANDROID_HOME $item))) { throw "Pacote Android incompleto: $item" }
}
Write-Output "Ferramentas Android preparadas em $pastaFerramentas"
