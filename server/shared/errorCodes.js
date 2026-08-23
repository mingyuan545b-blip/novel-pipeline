'use strict';

/**
 * 错误码集中注册表
 *
 * 全系统唯一的错误码定义来源，消除散落在 errors.js、errorHandler.js、
 * apiResponse.js、responseFormatter.js 中的硬编码错误码。
 *
 * 命名规范：UPPER_SNAKE_CASE
 * 分类字段 category 用于按域检索（llm/pipeline/storage/auth/api/validation）
 *
 * 文件位置：server/shared/errorCodes.js
 */

const ERROR_CODES = Object.freeze({
    // ── API 层（HTTP 框架级错误）──
    INTERNAL_ERROR:      { code: 'INTERNAL_ERROR',      statusCode: 500, category: 'api',         retryable: false },
    PARSE_ERROR:         { code: 'PARSE_ERROR',         statusCode: 400, category: 'api',         retryable: false },
    PAYLOAD_TOO_LARGE:   { code: 'PAYLOAD_TOO_LARGE',   statusCode: 413, category: 'api',         retryable: false },
    SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', statusCode: 503, category: 'api',         retryable: true  },

    // ── 认证层 ──
    AUTH_ERROR:          { code: 'AUTH_ERROR',          statusCode: 401, category: 'auth',        retryable: false },

    // ── 校验层 ──
    VALIDATION_ERROR:    { code: 'VALIDATION_ERROR',    statusCode: 400, category: 'validation',  retryable: false },
    NOT_FOUND:           { code: 'NOT_FOUND',           statusCode: 404, category: 'validation',  retryable: false },
    FORBIDDEN:           { code: 'FORBIDDEN',           statusCode: 403, category: 'validation',  retryable: false },
    CONFLICT:            { code: 'CONFLICT',            statusCode: 409, category: 'validation',  retryable: false },
    INVALID_TRANSITION:  { code: 'INVALID_TRANSITION',  statusCode: 422, category: 'validation',  retryable: false },

    // ── LLM 层 ──
    LLM_OVERLOADED:      { code: 'LLM_OVERLOADED',      statusCode: 500, category: 'llm',         retryable: true },
    LLM_TIMEOUT:         { code: 'LLM_TIMEOUT',         statusCode: 500, category: 'llm',         retryable: true },
    CONTEXT_OVERFLOW:    { code: 'CONTEXT_OVERFLOW',    statusCode: 500, category: 'llm',         retryable: false },

    // ── Pipeline 层 ──
    PIPELINE_ERROR:      { code: 'PIPELINE_ERROR',      statusCode: 500, category: 'pipeline',    retryable: false },
    PIPELINE_STOPPED:    { code: 'PIPELINE_STOPPED',    statusCode: 500, category: 'pipeline',    retryable: false },
    REVIEW_REJECTION:    { code: 'REVIEW_REJECTION',    statusCode: 422, category: 'pipeline',    retryable: false },
    PIPELINE_CONTRACT_VIOLATION: { code: 'PIPELINE_CONTRACT_VIOLATION', statusCode: 500, category: 'pipeline', retryable: false },

    // ── 存储层 ──
    STORAGE_ERROR:       { code: 'STORAGE_ERROR',       statusCode: 500, category: 'storage',     retryable: false },
    CONCURRENCY_ERROR:   { code: 'CONCURRENCY_ERROR',   statusCode: 500, category: 'storage',     retryable: false },
    DATA_CORRUPTION:     { code: 'DATA_CORRUPTION',     statusCode: 500, category: 'storage',     retryable: false }
});

/**
 * 根据错误码字符串获取完整定义
 * @param {string} code - 错误码（如 'LLM_OVERLOADED'）
 * @returns {Object|null} 错误码定义，未找到返回 null
 */
function getErrorInfo(code) {
    const entry = Object.values(ERROR_CODES).find(e => e.code === code);
    return entry || null;
}

/**
 * 判断错误码是否可重试
 * @param {string} code - 错误码
 * @returns {boolean}
 */
function isRetryable(code) {
    const info = getErrorInfo(code);
    return info ? info.retryable : false;
}

/**
 * 根据错误码获取 HTTP 状态码
 * @param {string} code - 错误码
 * @returns {number} 默认 500
 */
function getStatusCode(code) {
    const info = getErrorInfo(code);
    return info ? info.statusCode : 500;
}

module.exports = {
    ERROR_CODES,
    getErrorInfo,
    isRetryable,
    getStatusCode
};
