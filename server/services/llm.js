const logger = require('../shared/logger');
const axios = require('axios');
const { getRateLimiter, getTokenBucket } = require('./rateLimiter');
const providerRegistry = require('../config/providerRegistry');
const { resolveProviderKey } = require('../config/providerRegistry');
const { DEFAULT_MODEL } = require('../config/modelResolver');
const { normalizeMessageContent } = require('./llmResponseParser');
const { waitForRetry } = require('./llmRetryUtils');
const { buildRequestPayload, buildRequestHeaders, classifyAndHandleError } = require('./llmRequestBuilder');
const llmMetrics = require('./llmMetrics');
const { LLM_DEFAULTS } = require('../config/systemConfig');

function getProviders() {
    return providerRegistry.getProviderList();
}

function getProviderConfig(providerKey) {
    return providerRegistry.getProviderConfig(providerKey);
}

const llmConfig = require('./llmConfig');

async function resolveConfig(apiConfig) {
    return await llmConfig.resolveConfig(apiConfig);
}

async function chat(messages, options = {}) {
    const config = await resolveConfig(options.apiConfig);
    if (!config.apiKey) throw new Error('API Key not configured');

    const limiter = getRateLimiter(config.provider, { rpm: options.rpm, burst: options.burst });
    await limiter.acquire();

    const providerInfo = providerRegistry.PROVIDERS[config.provider];
    const tokenBucket = getTokenBucket(config.provider, { tpm: options.tpm || providerInfo?.tpmLimit });
    const estimatedInputTokens = Math.ceil(JSON.stringify(messages).length / 3);
    const estimatedOutputTokens = options.maxTokens || 8192;
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;
    await tokenBucket.acquire(estimatedTotalTokens);

    const maxRetries = options.maxRetries ?? 3;
    const retryDelay = options.retryDelay ?? 10000;

    const abortController = new AbortController();
    const externalSignal = options.signal;
    if (externalSignal) {
        if (externalSignal.aborted) throw new Error('LLM request aborted before start');
        externalSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
    // 超时优先级：调用方显式指定 > 供应商级覆盖（本地慢速模型放宽）> 全局默认
    const providerTimeout = providerRegistry.PROVIDERS?.[config.provider]?.requestTimeoutMs;
    const timeoutId = setTimeout(() => abortController.abort(), options.timeout || providerTimeout || LLM_DEFAULTS?.REQUEST_TIMEOUT_MS || 600000);
    if (externalSignal?.aborted) { clearTimeout(timeoutId); throw new Error('LLM request aborted before start'); }

    const payload = buildRequestPayload(config, messages, options);
    const headers = buildRequestHeaders(config);
    const url = `${config.baseURL}/chat/completions`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStart = Date.now();
        try {
            const response = await axios.post(url, payload, { headers, signal: abortController.signal });
            clearTimeout(timeoutId);
            const data = response.data;
            const choice = data.choices?.[0];
            const msg = choice?.message;

            const durationMs = Date.now() - attemptStart;

            logger.info('llm', `[LLM] Provider: ${config.provider}, Model: ${data.model || config.model}, Finish: ${choice?.finish_reason}`, {
                provider: config.provider, model: data.model || config.model, finishReason: choice?.finish_reason
            });
            logger.info('llm', `[LLM] Content length: ${msg?.content?.length || 0}`, {
                contentLength: msg?.content?.length || 0
            });

            const actualUsage = data.usage?.total_tokens || 0;
            if (actualUsage > 0) {
                const usageDiff = actualUsage - estimatedTotalTokens;
                tokenBucket.reportUsage(usageDiff > 0 ? usageDiff : 0);
                logger.info('llm', `[LLM] Token usage: ${actualUsage} (estimated: ${estimatedTotalTokens}, diff: ${usageDiff})`, {
                    provider: config.provider, model: data.model || config.model,
                    actualUsage, estimatedUsage: estimatedTotalTokens, usageDiff
                });
            }

            normalizeMessageContent(msg);

            llmMetrics.recordTokenUsage(config.provider, data.model || config.model, data.usage, true, durationMs);
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            const durationMs = Date.now() - attemptStart;
            const result = classifyAndHandleError(error, config, maxRetries, attempt, retryDelay, externalSignal);
            if (result.shouldRetry) {
                llmMetrics.recordTokenUsage(config.provider, config.model, null, false, durationMs);
                logger.info('llm', `[LLM] ${result.reason} (${config.provider}/${config.model}, code:${result.statusCode || 'network'}), retry ${attempt}/${maxRetries} in ${Math.round(result.delay/1000)}s...`, {
                    errorCode: result.statusCode === 529 || result.statusCode === 2064 ? 'LLM_OVERLOADED' : 'LLM_NETWORK',
                    provider: config.provider, model: config.model,
                    reason: result.reason, statusCode: result.statusCode || 0,
                    attempt, maxRetries, delayMs: result.delay, durationMs
                });
                await waitForRetry(result.delay, externalSignal);
                continue;
            }
            if (result.shouldThrow) {
                llmMetrics.recordTokenUsage(config.provider, config.model, null, false, durationMs);
                throw result.error;
            }
        }
    }
}

async function testConnection(apiConfig) {
    try {
        let resolved = { ...apiConfig };
        const { PROVIDER_DEFAULTS } = require('../config/systemConfig');
        if (!resolved.provider) {
            resolved.provider = resolveProviderKey(process.env.LLM_PROVIDER || PROVIDER_DEFAULTS.DEFAULT_PROVIDER) || 'aliyunCoding';
        }
        if (!resolved.apiKey) {
            const p = resolved.provider;
            if (p === 'aliyunCoding') { resolved.apiKey = process.env.ALIYUN_CODING_API_KEY || ''; if (!resolved.model) resolved.model = process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL; if (!resolved.baseURL) resolved.baseURL = process.env.ALIYUN_CODING_BASE_URL || PROVIDER_DEFAULTS.ALIYUN_CODING_BASE_URL; }
            else if (p === 'siliconflow') { resolved.apiKey = process.env.SILICONFLOW_API_KEY || ''; if (!resolved.baseURL) resolved.baseURL = PROVIDER_DEFAULTS.SILICONFLOW_BASE_URL; }
            else if (p === 'deepseek') { resolved.apiKey = process.env.DEEPSEEK_API_KEY || ''; if (!resolved.baseURL) resolved.baseURL = PROVIDER_DEFAULTS.DEEPSEEK_BASE_URL; }
        }
        const config = await resolveConfig(resolved);
        if (!config.apiKey) return { success: false, message: 'API Key not configured' };
        const agentName = resolved?.agentLabel || config.provider;
        const modelName = config.model;
        const result = await chat(
            [{ role: 'system', content: '你必须严格按照指定格式回复，不要添加任何额外内容。' },
             { role: 'user', content: `严格按此格式回复，不要添加其他内容：我是${agentName}，我使用的是${modelName}模型` }],
            { maxTokens: 500, temperature: 0.01, apiConfig: resolved }
        );
        const content = result.choices?.[0]?.message?.content || '(empty response)';
        const actualModel = result.model || modelName;
        return { success: true, message: content, provider: config.provider, model: actualModel, agentLabel: agentName, response: content };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    getProviders,
    getProviderConfig,
    resolveConfig,
    chat,
    testConnection,
    PROVIDERS: providerRegistry.PROVIDERS
};
