const providerRegistry = require('../config/providerRegistry');
const { LLMTimeoutError, ContextOverflowError } = require('../shared/errors');

// 供应商级思考关闭治理：llama.cpp系本地服务（LM Studio）的思考模型
// 不认API层enable_thinking参数。双保险（陷阱#94实测：复杂prompt下软标记会被无视）：
//   1) system追加硬指令（noThinkSystemDirective）
//   2) 末条user消息追加 /no_think 软标记（noThinkMarker）
// 均由providerDefs声明，未声明的供应商不受影响。
// 不修改原messages数组（调用方可能复用），返回浅拷贝链。
function applyNoThink(messages, marker, systemDirective) {
    if (!Array.isArray(messages) || messages.length === 0) return messages;
    let next = messages;

    // 1) system级硬指令
    if (systemDirective && next[0]?.role === 'system'
        && typeof next[0].content === 'string' && !next[0].content.includes(systemDirective)) {
        next = next.slice();
        next[0] = { ...next[0], content: next[0].content + '\n' + systemDirective };
    }

    // 2) 末条user消息软标记
    if (!marker) return next;
    let idx = -1;
    for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i]?.role === 'user') { idx = i; break; }
    }
    if (idx === -1) return next;
    const target = next[idx];
    const trimmed = marker.trim();
    if (typeof target.content === 'string') {
        if (target.content.includes(trimmed)) return next;
        const withUser = (next === messages) ? messages.slice() : next;
        withUser[idx] = { ...target, content: target.content + marker };
        return withUser;
    }
    if (Array.isArray(target.content)) {
        const blocks = target.content;
        let textIdx = -1;
        for (let i = blocks.length - 1; i >= 0; i -= 1) {
            if (blocks[i]?.type === 'text' && typeof blocks[i].text === 'string') { textIdx = i; break; }
        }
        if (textIdx === -1 || blocks[textIdx].text.includes(trimmed)) return next;
        const newBlocks = blocks.slice();
        newBlocks[textIdx] = { ...blocks[textIdx], text: blocks[textIdx].text + marker };
        const withUser = (next === messages) ? messages.slice() : next;
        withUser[idx] = { ...target, content: newBlocks };
        return withUser;
    }
    return next;
}

function buildRequestPayload(config, messages, options) {
    const providerDef = providerRegistry.PROVIDERS?.[config.provider];
    const needNoThink = providerDef && (providerDef.noThinkMarker || providerDef.noThinkSystemDirective) && options.enableThinking !== true;
    const finalMessages = needNoThink
        ? applyNoThink(messages, providerDef.noThinkMarker, providerDef.noThinkSystemDirective)
        : messages;
    const payload = {
        model: options.model || config.model,
        messages: finalMessages,
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

    // 兼容多种错误体形态：{error:{message}} / {error:"..."} / {message:"..."}
    const errMsg = error.response?.data?.error?.message
        || (typeof error.response?.data?.error === 'string' ? error.response.data.error : '')
        || error.response?.data?.message
        || (typeof error.response?.data === 'string' ? error.response.data.slice(0, 300) : '')
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
