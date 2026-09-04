@echo off
set JAVA_HOME=C:\Program Files (x86)\Android\openjdk\jdk-17.0.14
set ANDROID_HOME=C:\Users\kauaz\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\kauaz\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\cmdline-tools\latest\bin

cd /d "C:\Users\kauaz\Desktop\projetos\ia dieta\nutrifoto"

echo === RODANDO npx cap run android ===
call npx cap run android 2>&1
if errorlevel 1 (
    echo ERRO: npx cap run falhou
    pause
    exit /b 1
)

echo.
echo === VERIFICANDO APK ===
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo APK encontrado: android\app\build\outputs\apk\debug\app-debug.apk
) else (
    echo APK NAO encontrado no caminho esperado
)

echo.
echo === VERIFICANDO DISPOSITIVOS ===
"%ANDROID_HOME%\platform-tools\adb.exe" devices

echo.
echo === FIM ===
pause