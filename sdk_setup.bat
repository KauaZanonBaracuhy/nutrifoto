@echo off
set "JAVA_HOME=C:\Program Files (x86)\Android\openjdk\jdk-17.0.14"
set "ANDROID_HOME=C:\Users\kauaz\Android\Sdk"

echo === LISTANDO PACOTES ===
call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --list

echo.
echo === INSTALANDO EMULATOR + SYSTEM IMAGE + PLATFORM TOOLS ===
call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --install "emulator" "system-images;android-34;google_apis;x86_64" "platform-tools" --sdk_root="%ANDROID_HOME%"

echo.
echo === ACEITANDO LICENSES ===
echo y| call "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses --sdk_root="%ANDROID_HOME%"
