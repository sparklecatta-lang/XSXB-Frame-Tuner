@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

set "PORT=5179"
set "URL=http://127.0.0.1:%PORT%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Please install Node.js or open this project from a terminal that has node available.
  pause
  exit /b 1
)

echo Starting XSXB Frame Tuner...
echo Project: %CD%
echo URL: %URL%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Stopping existing XSXB Frame Tuner process %%P...
  taskkill /PID %%P /F >nul 2>nul
)

start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 800; Start-Process '%URL%'"

node tools\animation_tuner\server.js

echo.
echo XSXB Frame Tuner stopped.
pause
