@echo off
title AI Novel Pipeline - Stopper
color 0C

echo.
echo  Stopping all services...
echo.

taskkill /fi "WINDOWTITLE eq NovelPipeline-Server*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq NovelPipeline-Client*" /f >nul 2>&1

echo  All services stopped.
echo.
pause
