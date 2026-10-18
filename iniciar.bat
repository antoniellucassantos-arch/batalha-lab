@echo off
title Batalha Lab
cd /d "%~dp0"
echo.
echo   BATALHA LAB - treino de rima
echo   Abrindo em http://localhost:8080  (feche esta janela para desligar)
echo.
start "" http://localhost:8080
where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8080
) else (
  npx --yes http-server -p 8080 -c-1
)
pause
