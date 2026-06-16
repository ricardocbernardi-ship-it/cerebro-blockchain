@echo off
title Parar CEREBRO
echo.
echo  Salvando blockchain e parando no CEREBRO...
pm2 stop cerebro
pm2 save
echo.
echo  [OK] No CEREBRO parado com seguranca.
echo.
pause
