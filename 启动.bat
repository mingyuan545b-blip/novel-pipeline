@echo off
chcp 65001 >nul
echo ============================================
echo   AI 小说·漫剧 生产流水线 - 启动脚本
echo ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检查后端依赖...
if not exist "server\node_modules" (
    echo 正在安装后端依赖...
    cd server && npm install && cd ..
) else (
    echo 后端依赖已就绪
)

echo [2/4] 检查前端依赖...
if not exist "client\node_modules" (
    echo 正在安装前端依赖...
    cd client && npm install && cd ..
) else (
    echo 前端依赖已就绪
)

echo [3/4] 检查环境配置...
if not exist "server\.env" (
    echo 正在创建默认配置...
    (
        echo ALIYUN_CODING_API_KEY=你的API_KEY
        echo ALIYUN_CODING_MODEL=qwen3-plus
        echo PORT=3001
    ) > server\.env
    echo [注意] 已创建 server\.env 默认配置文件，请编辑填入你的 API Key！
    echo.
    notepad server\.env
)

echo [4/4] 启动服务...
echo.
echo 正在启动后端 (端口 3001)...
start "NovelPipeline-Server" cmd /k "cd /d %~dp0server && node index.js"

timeout /t 3 /nobreak >nul

echo 正在启动前端 (端口 5173)...
start "NovelPipeline-Client" cmd /k "cd /d %~dp0client && npx vite --host"

echo.
echo ============================================
echo   启动完成！
echo   前端地址: http://localhost:5173
echo   后端地址: http://localhost:3001
echo   API文档:  http://localhost:3001/api/health
echo ============================================
echo.
echo 首次使用请先在"系统设置"中配置 API Key
echo 关闭此窗口不会停止服务，需关闭对应的命令行窗口
echo.
pause
