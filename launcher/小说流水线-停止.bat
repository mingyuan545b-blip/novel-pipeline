@echo off
chcp 65001 >nul
cd /d C:\Users\mingy\Desktop\trae\novel-pipeline
echo Stopping backend ...
node scripts\serverStart.js --stop
echo Stopping frontend port 5173 ...
node scripts\killPort.js 5173 2>nul
echo Done
timeout /t 2 >nul
