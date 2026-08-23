@echo off
chcp 65001 >nul
title Novel Pipeline Launcher
set PROJ=C:\Users\mingy\Desktop\trae\novel-pipeline
cd /d %PROJ%

echo ============================================
echo   AI Novel Pipeline - One Click Start
echo ============================================

echo [1/3] Backend port 3001 ...
netstat -ano | findstr ":3001 " | findstr LISTENING >nul
if errorlevel 1 (
    start "NP-Backend" /min cmd /c "cd /d %PROJ% && node scripts\serverStart.js --start"
    timeout /t 8 /nobreak >nul
) else (
    echo     already running, skip
)

echo [2/3] Frontend port 5173 ...
netstat -ano | findstr ":5173 " | findstr LISTENING >nul
if errorlevel 1 (
    start "NP-Frontend" /min cmd /c "cd /d %PROJ%\client && npm run dev"
    timeout /t 6 /nobreak >nul
) else (
    echo     already running, skip
)

echo [3/3] Health check ...
curl -s -m 5 http://localhost:3001/api/health | findstr "healthy" >nul
if errorlevel 1 (
    echo     WARN backend health check failed, opening frontend anyway
) else (
    echo     OK backend healthy - PostgreSQL
)

start http://localhost:5173
echo.
echo Browser opened. Use the Stop button to shut down services.
timeout /t 3 >nul
