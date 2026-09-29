@echo off
REM pgBackupTask.bat — PG 定时备份外壳（供 Windows 任务计划 / 手动双击调用）
REM 安装定时任务：见 docs/sop/11-数据备份与恢复.md
REM 文件位置：scripts/pgBackupTask.bat
setlocal
set "ROOT=%~dp0.."
set "LOGDIR=%ROOT%\backups\pg\_logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
cd /d "%ROOT%"
echo ===== %DATE% %TIME% ===== >> "%LOGDIR%\backup.log"
node scripts\pgBackup.js >> "%LOGDIR%\backup.log" 2> "%LOGDIR%\backup.err.log"
if %ERRORLEVEL% NEQ 0 (
  echo [FAIL] exit=%ERRORLEVEL% >> "%LOGDIR%\backup.log"
) else (
  echo [OK] backup finished >> "%LOGDIR%\backup.log"
)
exit /b %ERRORLEVEL%
