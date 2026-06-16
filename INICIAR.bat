@echo off
title CEREBRO Blockchain
echo.
echo  CEREBRO BLOCKCHAIN
echo  ==================
echo.
pm2 status cerebro 2>nul | findstr "online" >nul
if %errorlevel%==0 (
    echo  [OK] No CEREBRO ja esta rodando!
    echo.
    echo  API REST  : http://localhost:3001/api
    echo  Explorer  : http://localhost:3001/explorer.html
    echo  Wallet    : http://localhost:3001/wallet.html
    echo.
    start "" "http://localhost:3001/explorer.html"
) else (
    echo  Iniciando no CEREBRO...
    cd /d "%~dp0"
    pm2 start no-completo.js --name cerebro --restart-delay=5000 --max-restarts=10
    pm2 save
    timeout /t 5 /nobreak >nul
    echo.
    echo  [OK] No CEREBRO ONLINE!
    echo.
    echo  API REST  : http://localhost:3001/api
    echo  Explorer  : http://localhost:3001/explorer.html
    echo  Wallet    : http://localhost:3001/wallet.html
    echo.
    start "" "http://localhost:3001/explorer.html"
)
echo.
pause
