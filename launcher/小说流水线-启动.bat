@echo off
chcp 65001 >nul
title 小说流水线启动器
set PROJ=C:\Users\mingy\Desktop\trae\novel-pipeline
cd /d %PROJ%

echo ============================================
echo   AI 小说流水线 - 一键启动
echo ============================================

echo [1/3] 后端 (3001)...
netstat -ano | findstr ":3001 " | findstr LISTENING >nul
if errorlevel 1 (
    start "NP-Backend" /min cmd /c "cd /d %PROJ% && node scripts\serverStart.js --start"
    timeout /t 8 /nobreak >nul
) else (
    echo     已在运行，跳过
)

echo [2/3] 前端 (5173)...
netstat -ano | findstr ":5173 " | findstr LISTENING >nul
if errorlevel 1 (
    start "NP-Frontend" /min cmd /c "cd /d %PROJ%\client && npm run dev"
    timeout /t 6 /nobreak >nul
) else (
    echo     已在运行，跳过
)

echo [3/3] 健康检查...
curl -s -m 5 http://localhost:3001/api/health | findstr "healthy" >nul
if errorlevel 1 (
    echo     ⚠ 后端健康检查未通过，仍打开前端页面
) else (
    echo     ✓ 后端健康 (PostgreSQL)
)

start http://localhost:5173
echo.
echo 浏览器已打开。关闭服务请用 小说流水线-停止.bat
timeout /t 3 >nul
