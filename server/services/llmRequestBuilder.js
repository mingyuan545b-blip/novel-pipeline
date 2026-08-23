const providerRegistry = require('../config/providerRegistry');
const { LLMTimeoutError, ContextOverflowError } = require('../shared/errors');

function buildRequestPayload(config, messages, options) {
    const payload = {
        model: options.model || config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
        stream: false,
        enable_thinking: options.enableThinking === true
    };
    return payload;
}

function buildRequestHeaders(config) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };

    const isCodingPlan = config.baseURL?.includes('coding.dashscope');
    if (isCodingPlan) {
        headers['User-Agent'] = 'OpenAI/JS 4.73.0';
        headers['X-Stainless-Lang'] = 'js';
        headers['X-Stainless-Package-Version'] = '4.73.0';
        headers['X-Stainless-OS'] = 'Windows';
        headers['X-Stainless-Arch'] = 'x64';
        headers['X-Stainless-Runtime'] = 'node';
        headers['X-Stainless-Runtime-Version'] = process.version;
    }

    return headers;
}

function classifyAndHandleError(error, config, maxRetries, attempt, retryDelay, externalSignal) {
    const { classifyApiError } = require('./llmRetryUtils');

    if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return { shouldThrow: true, error: new Error('LLM request was cancelled') };
    }
    if (error.code === 'ECONNABORTED') {
        return { shouldThrow: true, error: new LLMTimeoutError('API 请求超时(600s)，请检查网络或减少请求内容长度') };
    }
    if (error.message.startsWith('API returned error')) {
        return { shouldThrow: true, error };
    }

    const errMsg = error.response?.data?.error?.message
        || error.response?.data?.message
        || error.message;
    const statusCode = error.response?.data?.error?.code
        || error.response?.status;

    const { isOverloaded, isNetworkError, isContextOverflow } = classifyApiError(errMsg, statusCode);

    if ((isOverloaded || isNetworkError) && attempt < maxRetries) {
        const delay = retryDelay * Math.pow(1.5, attempt - 1);
        const reason = isNetworkError ? 'Network error' : 'Server overloaded';
        return { shouldRetry: true, delay, reason, statusCode };
    }

    if (isContextOverflow && !isOverloaded) {
        // 抛类型化 ContextOverflowError，下游可通过 instanceof 判定
        const err = new ContextOverflowError(errMsg);
        err.statusCode = statusCode;
        return { shouldThrow: true, error: err };
    }

    return {
        shouldThrow: true,
        error: new Error(`API Error (${config.provider}/${config.model}, code:${statusCode || 'unknown'}): ${errMsg}`)
    };
}

module.exports = {
    buildRequestPayload,
    buildRequestHeaders,
    classifyAndHandleError
};
