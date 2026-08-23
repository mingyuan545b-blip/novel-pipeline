const logger = require('../../shared/logger');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getConfig } = require('./comicConfig');

let comfyuiProcess = null;

async function startLocalComfyUI() {
    const config = await getConfig();
    const installDir = config.local?.installDir || config.installDir;
    const startCommand = config.local?.startCommand || config.startCommand;
    const apiUrl = config.local?.apiUrl || config.apiUrl || 'http://127.0.0.1:8188';

    if (!installDir || !startCommand) {
        return { success: false, message: '请先配置 ComfyUI 安装目录和启动命令' };
    }

    try {
        const axios = require('axios');
        const healthCheck = await axios.get(`${apiUrl}/system_stats`, { timeout: 3000 }).catch(() => null);
        if (healthCheck) return { success: true, message: 'ComfyUI 已在运行中' };
    } catch (_) { /* not running, proceed */ }

    if (comfyuiProcess) return { success: false, message: 'ComfyUI 进程已在运行中' };

    try {
        const pythonExe = path.join(installDir, '.venv', 'Scripts', 'python.exe');
        const mainPy = path.join(installDir, 'ComfyUI', 'main.py');
        const outputDir = path.join(__dirname, '..', '..', '..', 'output', 'comfyui');
        const inputDir = path.join(__dirname, '..', '..', '..', 'output', 'comfyui_input');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });

        comfyuiProcess = spawn(pythonExe, [mainPy, '--listen', '127.0.0.1', '--port', '8188', '--output-directory', outputDir, '--input-directory', inputDir], {
            cwd: installDir, stdio: 'pipe', detached: false,
            env: {
                ...process.env, HSA_OVERRIDE_GFX_VERSION: '11.0.0',
                PYTORCH_HIP_ALLOC_CONF: 'garbage_collection_threshold:0.6,max_split_size_mb:128',
                HIP_VISIBLE_DEVICES: '0', PYTHONUNBUFFERED: '1',
                VIRTUAL_ENV: path.join(installDir, '.venv'),
                PATH: path.join(installDir, '.venv', 'Scripts') + ';' + process.env.PATH
            }
        });

        comfyuiProcess.stdout.on('data', (data) => { logger.info('comfyUIProcess', `[ComfyUI] ${data.toString().trim()}`); });
        comfyuiProcess.stderr.on('data', (data) => { logger.error('comfyUIProcess', `[ComfyUI] ${data.toString().trim()}`); });
        comfyuiProcess.on('close', (code) => { logger.info('comfyUIProcess', `[ComfyUI] Process exited with code ${code}`); comfyuiProcess = null; });
        comfyuiProcess.on('error', (err) => { logger.error('comfyUIProcess', `[ComfyUI] Process error: ${err.message}`); comfyuiProcess = null; });

        return { success: true, message: `ComfyUI 启动命令已发送，目录: ${installDir}` };
    } catch (e) {
        return { success: false, message: `启动失败: ${e.message}` };
    }
}

async function stopLocalComfyUI() {
    if (!comfyuiProcess) return { success: false, message: '没有正在运行的 ComfyUI 进程' };
    try {
        comfyuiProcess.kill();
        comfyuiProcess = null;
        return { success: true, message: 'ComfyUI 进程已终止' };
    } catch (e) {
        return { success: false, message: `终止失败: ${e.message}` };
    }
}

function getComfyUIStatus() {
    return { running: !!comfyuiProcess };
}

module.exports = { startLocalComfyUI, stopLocalComfyUI, getComfyUIStatus };
