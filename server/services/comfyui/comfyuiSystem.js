const logger = require('../../shared/logger');
const axios = require('axios');
const { COMFYUI_URL, AUTO_FREE_DEFAULTS } = require('./comfyuiConstants');
const { LLM_DEFAULTS } = require('../../config/systemConfig');

async function getSystemInfo() {
    try {
        const resp = await axios.get(`${COMFYUI_URL}/system_stats`, { timeout: 5000 });
        return resp.data;
    } catch {
        return null;
    }
}

async function freeMemory(options = {}) {
    const unloadModels = options.unloadModels !== false;
    const freeMemory = options.freeMemory !== false;
    try {
        await axios.post(`${COMFYUI_URL}/free`, {
            unload_models: unloadModels,
            free_memory: freeMemory
        }, { timeout: 30000 });
        logger.info('comfyuiSystem', `[COMFYUI] Memory freed: unload_models=${unloadModels}, free_memory=${freeMemory}`);
        await new Promise(r => setTimeout(r, LLM_DEFAULTS.comfyuiFreeMemoryWaitMs));
        const stats = await getSystemInfo();
        const dev = stats?.devices?.[0];
        return {
            success: true,
            vramUsedGB: dev ? ((dev.vram_total - dev.vram_free) / 1073741824).toFixed(1) : null,
            vramTotalGB: dev ? (dev.vram_total / 1073741824).toFixed(1) : null,
            vramFreeGB: dev ? (dev.vram_free / 1073741824).toFixed(1) : null,
            ramFreeGB: stats ? (stats.system.ram_free / 1073741824).toFixed(1) : null
        };
    } catch (e) {
        logger.error('comfyuiSystem', `[COMFYUI] Free memory failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}

let autoFreeTimer = null;
let autoFreeConfig = { ...AUTO_FREE_DEFAULTS };

function setAutoFreeConfig(config) {
    autoFreeConfig = { ...autoFreeConfig, ...config };
    resetAutoFreeTimer();
    return autoFreeConfig;
}

function getAutoFreeConfig() {
    return { ...autoFreeConfig };
}

function resetAutoFreeTimer() {
    if (autoFreeTimer) {
        clearTimeout(autoFreeTimer);
        autoFreeTimer = null;
    }
    if (!autoFreeConfig.enabled) return;
    autoFreeTimer = setTimeout(async () => {
        try {
            const stats = await getSystemInfo();
            const dev = stats?.devices?.[0];
            if (dev) {
                const usageRatio = (dev.vram_total - dev.vram_free) / dev.vram_total;
                if (usageRatio > autoFreeConfig.vramThreshold) {
                    logger.info('comfyuiSystem', `[COMFYUI] Auto-free triggered: VRAM usage ${(usageRatio * 100).toFixed(0)}% > ${(autoFreeConfig.vramThreshold * 100).toFixed(0)}%`);
                    await freeMemory({ unloadModels: true, freeMemory: true });
                }
            }
        } catch (e) {
            logger.error('comfyuiSystem', `[COMFYUI] Auto-free error: ${e.message}`);
        }
    }, autoFreeConfig.idleSeconds * 1000);
}

function touchAutoFreeTimer() {
    resetAutoFreeTimer();
}

module.exports = { getSystemInfo, freeMemory, setAutoFreeConfig, getAutoFreeConfig, resetAutoFreeTimer, touchAutoFreeTimer };
