/**
 * modelResolver.js — 模型名称统一解析入口
 * 所有fallback 'qwen3.6-plus'必须走此模块，禁止各文件独立硬编码
 */
const { PROVIDER_DEFAULTS } = require('../config/systemConfig');

function resolveModel(overrides) {
    return overrides?.model
        || overrides?.apiConfig?.model
        || process.env.LLM_MODEL
        || process.env.ALIYUN_CODING_MODEL
        || PROVIDER_DEFAULTS.DEFAULT_MODEL;
}

function resolveModelWithEnv(envKey) {
    return process.env[envKey] || process.env.ALIYUN_CODING_MODEL || PROVIDER_DEFAULTS.DEFAULT_MODEL;
}

module.exports = { resolveModel, resolveModelWithEnv, DEFAULT_MODEL: PROVIDER_DEFAULTS.DEFAULT_MODEL };
