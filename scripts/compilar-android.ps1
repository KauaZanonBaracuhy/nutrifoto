param([switch]$SomenteApk)
$ErrorActionPreference = 'Stop'
$raizProjeto = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $raizProjeto
if (!$env:JAVA_HOME) { $env:JAVA_HOME = Join-Path $env:USERPROFILE '.nutrifoto/android/jdk' }
if (!$env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:USERPROFILE '.nutrifoto/android/sdk' }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
if (!(Test-Path "$env:JAVA_HOME/bin/java.exe")) { throw 'JDK ausente. Execute preparar-ambiente-android.ps1.' }
if (!(Test-Path "$env:ANDROID_HOME/platforms/android-36/android.jar")) { throw 'SDK 36 ausente. Execute preparar-ambiente-android.ps1.' }
$caminhoSdk = $env:ANDROID_HOME.Replace('\','/')
[IO.File]::WriteAllText((Join-Path $raizProjeto 'android/local.properties'), "sdk.dir=$caminhoSdk`n")
& node scripts/preparar-android.js
if ($LASTEXITCODE -ne 0) { throw 'Falha preparando os assets Android.' }
& node node_modules/@capacitor/cli/bin/capacitor sync android
if ($LASTEXITCODE -ne 0) { throw 'Falha sincronizando o Capacitor.' }
$tarefas = @('assembleRelease')
if (!$SomenteApk) { $tarefas += 'bundleRelease' }
& ./android/gradlew.bat -p android @tarefas --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Falha na compilacao de release.' }
$destino = Join-Path $raizProjeto 'builds/android-release'
New-Item -ItemType Directory -Force $destino | Out-Null
$gradle = Get-Content android/app/build.gradle -Raw
$versao = [regex]::Match($gradle, 'versionName "([^"]+)"').Groups[1].Value
$codigo = [regex]::Match($gradle, 'versionCode (\d+)').Groups[1].Value
$apk = Join-Path $destino "NutriFoto-$versao-$codigo-release.apk"
Copy-Item -LiteralPath android/app/build/outputs/apk/release/app-release.apk -Destination $apk -Force
if (!$SomenteApk) { Copy-Item -LiteralPath android/app/build/outputs/bundle/release/app-release.aab -Destination (Join-Path $destino "NutriFoto-$versao-$codigo-release.aab") -Force }
& "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'Assinatura do APK invalida.' }
Get-ChildItem -LiteralPath $destino -File | Where-Object { $_.Extension -in @('.apk','.aab') } | Get-FileHash -Algorithm SHA256 | Format-Table -AutoSize
Write-Output "Artefatos assinados: $destino"
