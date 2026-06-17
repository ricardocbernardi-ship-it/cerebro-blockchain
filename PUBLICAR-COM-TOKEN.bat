@echo off
title npm publish - cerebro-blockchain v3.0.0
echo.
echo ===================================================
echo  PUBLICAR cerebro-blockchain 3.0.0 NO NPM
echo ===================================================
echo.
echo PASSO 1: Va no Edge (aba "Just a moment")
echo    https://www.npmjs.com/settings/ricardocb/tokens
echo.
echo PASSO 2: Logue com  ricardocb / ricardocbernardi@hotmail.com
echo.
echo PASSO 3: Clique em "Generate New Token" ou "Classic Token"
echo.
echo PASSO 4: Selecione "Automation" e clique "Generate Token"
echo.
echo PASSO 5: COPIE o token gerado (npx_XXXXXX...)
echo.
echo PASSO 6: Cole abaixo quando perguntar:
echo.
set /p NPM_TOKEN="Cole seu token npm aqui: "
echo.
cd /d "C:\Users\usuario\Downloads\cerebro"
echo Configurando token...
npm set //registry.npmjs.org/:_authToken=%NPM_TOKEN%
echo.
echo Publicando cerebro-blockchain v3.0.0...
npm publish --access public
echo.
echo ===================================================
if %ERRORLEVEL% EQU 0 (
  echo  SUCESSO! Publicado em:
  echo  https://www.npmjs.com/package/cerebro-blockchain
) else (
  echo  ERRO ao publicar. Verifique o token e tente novamente.
)
echo ===================================================
pause
