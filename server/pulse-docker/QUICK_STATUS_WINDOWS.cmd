@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\STATUS_PULSE_DOCKER.ps1"
pause
