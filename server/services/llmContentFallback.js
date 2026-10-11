'use strict';

/**
 * llmContentFallback — 供应商"内容审核"拦截时的故障转移（从 llm.js 拆出，守单文件 ≤200 行）
 *
 * 根因（2026-10-11）：供应商对输入文本的内容安全审核（如 data_inspection_failed）被当作普通
 * 致命错误抛出，且无任何兜底 → 单章卡死，并因"章前素材门槛"连锁拦截后续章。
 */
const logger = require('../shared/logger');
const providerRegistry = require('../config/providerRegistry');
const { buildRequestPayload, buildRequestHeaders } = require('./llmRequestBuilder');

/** 占位密钥（.env.example 的 your-xxx）不算可用，否则兜底会用坏 key 再失败并覆盖真实错误 */
function isPlaceholderKey(k) {
    return !k || k.length < 16 || /^(your-|sk-xxx|changeme|placeholder|todo)/i.test(k);
}

/** 选一个已配置真实密钥、且不同于当前的备用供应商（如 deepseek）；无则 null */
async function resolveFallbackConfig(currentProvider) {
    try {
        const list = providerRegistry.getAvailableProviders();
        const candidates = list.filter(p => p.available && p.id !== currentProvider).map(p => p.id);
        for (const id of candidates) {
            try {
                const cfg = await providerRegistry.resolveConfig({ provider: id });
                if (cfg && cfg.apiKey && !isPlaceholderKey(cfg.apiKey)) return cfg;
            } catch (_) { /* 试下一个 */ }
        }
    } catch (_) { /* 无备用供应商 */ }
    return null;
}

/** 内容审核拦截时切换到备用供应商；无可用备用则记录并返回 null */
async function switchToFallback(config, messages, options) {
    const fb = await resolveFallbackConfig(config.provider);
    if (!fb) {
        logger.error('llm', `[LLM] 内容审核拦截（${config.provider}）且无可用备用供应商 → 抛出（需配置备用 provider 密钥）`);
        return null;
    }
    logger.warn('llm', `[LLM] 内容审核拦截（${config.provider}），故障转移至备用供应商 ${fb.provider}/${fb.model} 重试`);
    return {
        config: fb,
        payload: buildRequestPayload(fb, messages, options),
        headers: buildRequestHeaders(fb),
        url: `${fb.baseURL}/chat/completions`,
    };
}

module.exports = { resolveFallbackConfig, switchToFallback, isPlaceholderKey };
