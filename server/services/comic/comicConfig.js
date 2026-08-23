/**
 * comicConfig.js — ComfyUI配置管理
 * 配置读写、连接测试、目录管理
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const store = require('../../store');

const COMIC_DIR = path.join(__dirname, '..', '..', '..', 'output', 'comic');

function ensureComicDir(subDir) {
    const dir = path.join(COMIC_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function getConfig() {
    const config = await store.getItem('comic-config', 'global');
    return config || {
        local: {
            apiUrl: 'http://127.0.0.1:8188',
            wsUrl: 'ws://127.0.0.1:8188',
            outputDir: '',
            autoStart: false,
            gpuDevice: '0',
            vae: '',
            checkpoint: '',
            timeout: 300
        },
        cloud: {
            provider: 'comfyui-cloud',
            apiUrl: '',
            apiKey: '',
            apiSecret: '',
            region: 'cn-east-1',
            instanceType: 'gpu-a10',
            autoScale: true,
            minInstances: 0,
            maxInstances: 2,
            idleTimeout: 300
        }
    };
}

async function saveConfig(config) {
    await store.setItem('comic-config', 'global', config);
    ensureComicDir('workflows');
    return config;
}

async function testConnection(params) {
    const { type, ...config } = params;
    if (type === 'local') {
        try {
            const res = await axios.get(`${config.apiUrl}/system_stats`, { timeout: 10000 });
            const sys = res.data?.system || {};
            const devices = res.data?.devices || [];
            const deviceInfo = devices.map((d, i) =>
                `GPU${i}: ${d.name} | VRAM: ${Math.round((d.vram_total || 0) / 1073741824)}GB (空闲: ${Math.round((d.vram_free || 0) / 1073741824)}GB)`
            ).join('\n');
            return {
                success: true,
                message: `本地 ComfyUI 连接成功`,
                systemInfo: {
                    comfyuiVersion: sys.comfyui_version || '未知',
                    pythonVersion: sys.python_version || '未知',
                    pytorchVersion: sys.pytorch_version || '未知',
                    os: sys.os || '未知',
                    ramTotal: Math.round((sys.ram_total || 0) / 1073741824),
                    ramFree: Math.round((sys.ram_free || 0) / 1073741824),
                    devices: devices.map((d, i) => ({
                        index: i, name: d.name, type: d.type,
                        vramTotal: Math.round((d.vram_total || 0) / 1073741824),
                        vramFree: Math.round((d.vram_free || 0) / 1073741824)
                    })),
                    deviceSummary: deviceInfo
                }
            };
        } catch (e) {
            return { success: false, message: `连接失败: ${e.message}. 请确保 ComfyUI 已启动并监听 ${config.apiUrl}` };
        }
    } else {
        if (!config.apiUrl || !config.apiKey) {
            return { success: false, message: '请填写云端 API 地址和 API Key' };
        }
        try {
            await axios.get(`${config.apiUrl}/status`, {
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
                timeout: 15000
            });
            return { success: true, message: '云端 ComfyUI 连接成功' };
        } catch (e) {
            return { success: false, message: `云端连接失败: ${e.message}` };
        }
    }
}

module.exports = { COMIC_DIR, ensureComicDir, getConfig, saveConfig, testConnection };
