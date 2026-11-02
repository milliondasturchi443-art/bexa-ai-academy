@echo off
chcp 65001 >nul
title Bexa AI Academy
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js o'rnatilmagan.
  echo  https://nodejs.org saytidan LTS versiyani yuklab o'rnating, keyin start.bat ni qayta oching.
  echo.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo  Kerakli paketlar o'rnatilmoqda, biroz kuting...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo  [!] npm install xato berdi. Internetni tekshiring. & pause & exit /b )
)
echo.
echo  Sayt ishga tushdi:  http://localhost:3000
echo  To'xtatish uchun bu oynani yoping.
echo.
start "" http://localhost:3000
node server.js
pause
