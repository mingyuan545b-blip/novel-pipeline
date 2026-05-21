@echo off
title AI Novel Pipeline - Launcher
color 0A

echo.
echo  [N0VEL PIPELINE] Starting...
echo.

echo [1/3] Starting backend (port 3001)...
start "NovelPipeline-Server" /min cmd /c "cd /d %~dp0server && node index.js"
timeout /t 3 /nobreak >nul

echo [2/3] Starting frontend (port 5173)...
start "NovelPipeline-Client" /min cmd /c "cd /d %~dp0client && npm run dev"
timeout /t 5 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:5173

echo.
echo  Done! Frontend: http://localhost:5173
echo  Backend API: http://localhost:3001
echo.
pause
