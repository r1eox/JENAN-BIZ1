@echo off
chcp 65001 >nul
title Janan Biz
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "Janan Biz" /min cmd /c "cd /d %~dp0backend && set PORT=5001 && ..\node\node.exe server.js"
timeout /t 3 /nobreak >nul
start http://localhost:5001
exit