@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo   NutriFoto — Build + Emulador + Instalar
echo   %date% %time%
echo ============================================
echo.

rem ───────────────────────────────────────────
rem 1. JAVA_HOME e ANDROID_HOME
rem ───────────────────────────────────────────
set "JAVA_HOME=C:\Program Files (x86)\Android\openjdk\jdk-17.0.14"
set "ANDROID_HOME=C:\Users\kauaz\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

echo [1/7] Verificando JDK...
if not exist "%JAVA_HOME%\bin\java.exe" (
    echo ERRO: JDK nao encontrado em "%JAVA_HOME%"
    echo Instale o JDK 17 no caminho acima ou edite JAVA_HOME neste script.
    goto :fim_erro
)
"%JAVA_HOME%\bin\java.exe" -version 2>&1
echo.

echo [2/7] Verificando .env...
if not exist ".env" (
    echo ERRO: Arquivo .env nao encontrado.
    echo Copie .env.example para .env e configure OPENROUTER_API_KEY.
    goto :fim_erro
)
echo   .env encontrado.
echo.

rem ───────────────────────────────────────────
rem 3. Build web + Android (gera www/ e copia)
rem ───────────────────────────────────────────
echo [3/7] Build web + Android (shared/ + web/ → www/ → android/assets)...
call node shared/scripts/build.js
if %errorlevel% neq 0 (
    echo ERRO: Build web falhou.
    goto :fim_erro
)
call npx cap copy android
if %errorlevel% neq 0 (
    echo ERRO: cap copy android falhou.
    goto :fim_erro
)
echo   Build web+Android concluido.
echo.

rem ───────────────────────────────────────────
rem 4. Gradle clean + assembleDebug
rem ───────────────────────────────────────────
echo [4/7] Compilando APK (gradlew clean + assembleDebug)...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo ERRO: gradlew clean falhou.
    cd ..
    goto :fim_erro
)
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ERRO: assembleDebug falhou.
    cd ..
    goto :fim_erro
)
cd ..
echo   APK compilado com sucesso.
echo.

rem ───────────────────────────────────────────
rem 5. Copiar APK para builds/ com data
rem ───────────────────────────────────────────
echo [5/7] Copiando APK para builds/...
set "APK_SRC=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK_SRC%" (
    echo ERRO: APK nao encontrado em %APK_SRC%
    goto :fim_erro
)

rem Formatar data: AAAA-MM-DD
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value 2^>nul') do set "DT=%%i"
set "YYYY=%DT:~0,4%"
set "MM=%DT:~4,2%"
set "DD=%DT:~6,2%"
set "APK_NAME=nutrifoto-debug-%YYYY%-%MM%-%DD%.apk"

if not exist "builds" mkdir builds
copy /y "%APK_SRC%" "builds\%APK_NAME%" >nul
echo   APK copiado: builds\%APK_NAME%
echo.

rem ───────────────────────────────────────────
rem 6. Verificar/iniciar emulador
rem ───────────────────────────────────────────
echo [6/7] Verificando emulador...

set "AVD_NAME=Pixel_7"
set "EMULATOR_RUNNING=0"

for /f "tokens=1" %%d in ('adb devices 2^>nul ^| findstr /r "emulator-.*device$"') do (
    set "EMULATOR_RUNNING=1"
    echo   Emulador ja rodando: %%d
)

if "%EMULATOR_RUNNING%"=="0" (
    echo   Nenhum emulador detectado. Iniciando %AVD_NAME%...
    start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd %AVD_NAME% -no-snapshot -gpu host
    
    echo   Aguardando boot do emulador (pode levar ate 2 minutos)...
    adb wait-for-device
    
    echo   Aparelho conectado. Aguardando boot completo...
    :wait_boot
    set "BOOT_COMPLETE=0"
    for /f "tokens=*" %%r in ('adb shell getprop sys.boot_completed 2^>nul') do (
        if "%%r"=="1" set "BOOT_COMPLETE=1"
    )
    if "%BOOT_COMPLETE%"=="0" (
        timeout /t 3 /nobreak >nul
        goto :wait_boot
    )
    echo   Emulador pronto!
) else (
    echo   Emulador ja esta pronto.
)
echo.

rem ───────────────────────────────────────────
rem 7. Instalar APK
rem ───────────────────────────────────────────
echo [7/7] Instalando APK no emulador...
adb install -r "builds\%APK_NAME%"
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar APK.
    goto :fim_erro
)
echo   APK instalado com sucesso!
echo.

echo ============================================
echo   PRONTO! App NutriFoto instalado no emulador.
echo   APK salvo em: builds\%APK_NAME%
echo   Abra o app pelo icone na gaveta do emulador.
echo ============================================
goto :fim_ok

:fim_erro
echo.
echo ============================================
echo   FALHA — veja a mensagem de erro acima.
echo ============================================
exit /b 1

:fim_ok
endlocal
exit /b 0
