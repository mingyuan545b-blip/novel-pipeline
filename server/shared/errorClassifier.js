'use strict';

/**
 * LLM 错误分类器
 *
 * 基于错误消息模式匹配 + instanceof 判定，将原始 Error 分类为
 * 类型化的 LLMOverloadedError / LLMTimeoutError / ContextOverflowError。
 *
 * 模式常量全系统唯一来源，消除 llmRetryUtils.js 的重复实现。
 *
 * 注意：与 errors.js 存在循环依赖（errors.js 重新导出本模块的函数），
 * 因此 errors.js 的类型化错误类采用 lazy require，避免模块加载时序问题。
 *
 * 文件位置：server/shared/errorClassifier.js
 */

// ── 错误分类模式常量（全系统唯一来源）──
const OVERLOAD_PATTERNS = ['529', '2064', 'overloaded', 'rate limit', '负载较高', 'throttling', 'quota'];
const TIMEOUT_PATTERNS = ['timeout', 'timed out', '超时', 'etimedout', 'aborted'];
const CONTEXT_OVERFLOW_PATTERNS = ['context_length_exceeded', 'context_length', 'context_overflow'];
const CODE_BUG_PATTERNS = ['is not defined', 'referenceerror', 'typeerror', 'cannot read'];
const NETWORK_PATTERNS = ['etimedout', 'econnreset', 'econnrefused', 'fetch failed', 'network', 'socket hang up', 'enotfound', 'connect econn', 'read econn'];

function _matchPatterns(msg, patterns) {
    const lower = (msg || '').toLowerCase();
    return patterns.some(p => lower.includes(p));
}

// lazy require errors.js：打破循环依赖
// errors.js 在 module.exports 之后才会被 errorClassifier 的调用方使用，
// 因此函数被实际调用时 errors.js 已完成加载。
function _getErrorClasses() {
    return require('./errors');
}

/**
 * 将原始 Error 分类为类型化 LLM 错误
 * @param {Error} error - 原始错误
 * @returns {Error} 类型化错误（若匹配）或原始错误
 */
function classifyLLMError(error) {
    const msg = error.message || '';
    const status = error.status || error.statusCode || 0;
    const { LLMOverloadedError, LLMTimeoutError, ContextOverflowError } = _getErrorClasses();

    if (status === 529 || status === 2064 || _matchPatterns(msg, OVERLOAD_PATTERNS)) {
        return new LLMOverloadedError(error.message);
    }

    if (_matchPatterns(msg, TIMEOUT_PATTERNS)) {
        return new LLMTimeoutError(error.message);
    }

    if (_matchPatterns(msg, CONTEXT_OVERFLOW_PATTERNS) || error.isContextOverflow) {
        return new ContextOverflowError(error.message, error.estimatedTokens, error.budget);
    }

    return error;
}

function isLLMOverloaded(error) {
    const { LLMOverloadedError } = _getErrorClasses();
    if (error instanceof LLMOverloadedError) return true;
    const status = error.status || error.statusCode || 0;
    if (status === 529 || status === 2064) return true;
    return _matchPatterns(error.message, OVERLOAD_PATTERNS);
}

function isLLMTimeout(error) {
    const { LLMTimeoutError } = _getErrorClasses();
    if (error instanceof LLMTimeoutError) return true;
    return _matchPatterns(error.message, TIMEOUT_PATTERNS);
}

function isCodeBug(error) {
    return _matchPatterns(error.message, CODE_BUG_PATTERNS);
}

function isNetworkError(error) {
    return _matchPatterns(error.message, NETWORK_PATTERNS);
}

function isContextOverflow(error) {
    const { ContextOverflowError } = _getErrorClasses();
    if (error instanceof ContextOverflowError || error.isContextOverflow) return true;
    return _matchPatterns(error.message, CONTEXT_OVERFLOW_PATTERNS);
}

module.exports = {
    classifyLLMError,
    isLLMOverloaded,
    isLLMTimeout,
    isCodeBug,
    isNetworkError,
    isContextOverflow,
    OVERLOAD_PATTERNS,
    NETWORK_PATTERNS,
    TIMEOUT_PATTERNS,
    CONTEXT_OVERFLOW_PATTERNS,
    CODE_BUG_PATTERNS
};
