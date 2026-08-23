/**
 * sensitiveFilter.js
 * 敏感信息过滤 — 日志和API响应中过滤API Key、密码等
 */
const SENSITIVE_KEY_PATTERNS = [
    /api[_-]?key/i, /secret/i, /password/i,
    /authorization/i, /cookie/i, /encryption/i
];

// Keys named 'token' are only sensitive if they look like API keys/secrets.
// Auth tokens (htk_ prefix) are session tokens needed by the frontend and must NOT be masked.
const TOKEN_KEY_PATTERN = /^token$/i;
const AUTH_TOKEN_PREFIX = 'htk_';

function maskValue(value) {
    if (typeof value !== 'string' || value.length < 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

function filterSensitive(obj, depth = 0) {
    if (depth > 8 || obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => filterSensitive(item, depth + 1));
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const isSensitive = SENSITIVE_KEY_PATTERNS.some(p => p.test(key));
        const isTokenKey = TOKEN_KEY_PATTERN.test(key);
        if (isTokenKey && typeof value === 'string') {
            // Auth session tokens (htk_) must pass through unmasked — frontend needs them
            result[key] = value.startsWith(AUTH_TOKEN_PREFIX) ? value : maskValue(value);
        } else if (isSensitive && typeof value === 'string') {
            result[key] = maskValue(value);
        } else {
            result[key] = filterSensitive(value, depth + 1);
        }
    }
    return result;
}

function filterApiResponse(data) {
    if (!data || typeof data !== 'object') return data;
    return filterSensitive(data);
}

module.exports = { filterApiResponse, filterSensitive, maskValue };
