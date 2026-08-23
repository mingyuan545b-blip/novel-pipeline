@echo off
chcp 65001 >nul
cd /d C:\Users\mingy\Desktop\trae\novel-pipeline
echo 停止后端...
node scripts\serverStart.js --stop
echo 停止前端(5173)...
node scripts\killPort.js 5173 2>nul
echo 完成
timeout /t 2 >nul
