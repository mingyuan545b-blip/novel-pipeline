@echo off
REM registerBackupTask.bat - register the daily PG backup scheduled task (cmd-native).
REM Replaces the legacy PowerShell version (registerBackupTask.ps1); prefer cmd on this host.
REM Usage:
REM   scripts\registerBackupTask.bat             register (default 03:30)
REM   scripts\registerBackupTask.bat 04:15       register (custom time)
REM   scripts\registerBackupTask.bat /uninstall  remove task
setlocal
set "TASKNAME=NovelPipeline-PG-Backup"
set "ARG=%~1"

if /I "%ARG%"=="/uninstall" goto uninstall

set "BKTIME=%ARG%"
if "%BKTIME%"=="" set "BKTIME=03:30"

set "BAT=%~dp0pgBackupTask.bat"
if not exist "%BAT%" goto no_bat

schtasks /Create /TN "%TASKNAME%" /TR "\"%BAT%\"" /SC DAILY /ST %BKTIME% /F
if errorlevel 1 goto create_fail

echo [OK] Task registered: %TASKNAME% (daily %BKTIME%)
echo Verify now: schtasks /Run /TN "%TASKNAME%"
echo List backups: node scripts\pgBackup.js --list
exit /b 0

:no_bat
echo [FAIL] Missing backup shell: %BAT%
exit /b 1

:create_fail
echo [FAIL] schtasks /Create failed
exit /b 1

:uninstall
schtasks /Delete /TN "%TASKNAME%" /F
exit /b %ERRORLEVEL%
