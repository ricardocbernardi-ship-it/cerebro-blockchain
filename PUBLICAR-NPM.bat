@echo off
title npm publish - cerebro-blockchain
cd /d "C:\Users\usuario\Downloads\cerebro"
echo.
echo ===================================
echo  PUBLICAR cerebro-blockchain 3.0.0
echo ===================================
echo.
echo Passo 1: Login no npm...
echo (O browser vai abrir - faz o login)
echo.
npm adduser
echo.
echo Passo 2: Publicando no npm...
npm publish
echo.
echo ===================================
echo  FEITO! Pacote publicado no npm!
echo  https://www.npmjs.com/package/cerebro-blockchain
echo ===================================
pause
