@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell.exe"

if not exist "%USERPROFILE%\.claude\start-claude.ps1" (
    echo [WARN] 未找到 ~/.claude/start-claude.ps1，直接使用 claude 命令。
    claude %*
    exit /b %ERRORLEVEL%
)

echo ============================================
echo   Claude Code - novel-pipeline
echo   目录: %CD%
echo ============================================
echo.

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\.claude\start-claude.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
    echo.
    echo [ERROR] Claude Code 退出码: %EXITCODE%
    pause
)
endlocal
exit /b %EXITCODE%
