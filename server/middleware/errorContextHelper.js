'use strict';

/**
 * 错误上下文提取器
 *
 * 从请求对象中提取上下文信息（method, path, query, body, headers），
 * 用于 errorHandler 记录错误时关联请求上下文，便于错误追踪。
 *
 * 职责：
 * 1. 提取请求上下文字段
 * 2. 复用 sensitiveFilter 脱敏敏感字段（apiKey/password/token 等）
 * 3. 截断超长 body/query，避免日志膨胀
 *
 * 文件位置：server/middleware/errorContextHelper.js
 */

const { filterSensitive } = require('./sensitiveFilter');

const MAX_BODY_LENGTH = 2000;
const MAX_QUERY_LENGTH = 500;
const SAFE_HEADERS = ['content-type', 'user-agent', 'accept', 'origin', 'referer'];

function truncate(value, maxLength) {
    if (typeof value !== 'string') return value;
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...[truncated]';
}

function truncateBody(body) {
    if (body === null || body === undefined) return null;
    if (typeof body === 'string') return truncate(body, MAX_BODY_LENGTH);
    try {
        const json = JSON.stringify(body);
        if (json.length <= MAX_BODY_LENGTH) return filterSensitive(body);
        return truncate(json, MAX_BODY_LENGTH);
    } catch {
        return '[unserializable]';
    }
}

function truncateQuery(query) {
    if (!query || typeof query !== 'object') return null;
    try {
        const filtered = filterSensitive(query);
        const json = JSON.stringify(filtered);
        return truncate(json, MAX_QUERY_LENGTH);
    } catch {
        return '[unserializable]';
    }
}

function extractSafeHeaders(headers) {
    if (!headers || typeof headers !== 'object') return {};
    const result = {};
    for (const key of SAFE_HEADERS) {
        if (headers[key]) result[key] = headers[key];
    }
    return result;
}

/**
 * 从 Express req 对象提取错误上下文
 * @param {Object} req - Express 请求对象
 * @returns {Object} 上下文对象（method, path, url, query, body, headers, ip）
 */
function extractRequestContext(req) {
    if (!req) return null;
    return {
        method: req.method || 'UNKNOWN',
        path: req.path || req.url || 'UNKNOWN',
        url: req.originalUrl || req.url || '',
        query: truncateQuery(req.query),
        body: truncateBody(req.body),
        headers: extractSafeHeaders(req.headers),
        ip: req.ip || req.socket?.remoteAddress || ''
    };
}

module.exports = {
    extractRequestContext,
    truncate,
    truncateBody,
    truncateQuery
};
