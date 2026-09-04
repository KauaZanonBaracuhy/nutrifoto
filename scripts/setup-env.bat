@echo off
REM setup-env.bat — versão Windows para configurar a chave via prompt do CMD
REM Alternativa ao setup-env.js se readline não funcionar bem no seu terminal
REM
REM Uso: abre PowerShell ou CMD nesta pasta e roda:  setup-env.bat
REM Cole a chave quando pedir e dê Enter.

setlocal

set ENVFILE=.env

if exist "%ENVFILE%" (
  echo.
  echo  .env ja existe.
  echo.
) else (
  echo.
  echo  Criando .env pela primeira vez.
  echo.
)

echo  Cole sua chave da OpenRouter (comeca com sk-or-v1-):
set /p KEY=

if "%KEY%"=="" (
  echo  Nenhuma chave fornecida. Saindo.
  exit /b 1
)

echo %KEY%| findstr /b "sk-or-v1-" >nul
if errorlevel 1 (
  echo  Chave invalida. Deve comecar com sk-or-v1-.
  exit /b 1
)

echo OPENROUTER_API_KEY=%KEY%> "%ENVFILE%"
echo.
echo  .env criado/atualizado. Chave gravada.
echo  NUNCA faca commit do .env.
echo.
endlocal
