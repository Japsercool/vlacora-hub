@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\INSTALL_PULSE_DOCKER.ps1"
pause
