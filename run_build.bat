@echo off
set JAVA_HOME=C:\Program Files (x86)\Android\openjdk\jdk-17.0.14
set ANDROID_HOME=C:\Users\kauaz\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\kauaz\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\cmdline-tools\latest\bin

cd /d "C:\Users\kauaz\Desktop\projetos\ia dieta\nutrifoto"

echo === RODANDO npm install ===
call npm install 2>&1
if errorlevel 1 (
    echo ERRO: npm install falhou
    pause
    exit /b 1
)

echo.
echo === RODANDO npx cap sync android ===
call npx cap sync android 2>&1
if errorlevel 1 (
    echo ERRO: npx cap sync falhou
    pause
    exit /b 1
)

echo.
echo === VERIFICANDO DISPOSITIVOS ===
"%ANDROID_HOME%\platform-tools\adb.exe" devices

echo.
echo === LISTANDO AVDs ===
"%ANDROID_HOME%\emulator\emulator.exe" -list-avds

echo.
echo === TUDO PRONTO ===
pause