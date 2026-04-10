@echo off
chcp 65001 >nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul