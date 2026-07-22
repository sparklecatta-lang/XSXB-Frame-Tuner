@echo off
setlocal
chcp 65001 >nul

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch_tuner.ps1" -Mode lite
if errorlevel 1 pause
