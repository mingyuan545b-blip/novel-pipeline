const crypto = require('crypto');
const { ERROR_CODES } = require('../shared/errorCodes');

const { AUTH_ERROR, FORBIDDEN } = ERROR_CODES;

const HTTP_TOKEN_PREFIX = 'htk_';
const HTTP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HTTP_TOKEN_RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const _httpTokens = new Map();

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) {
        crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function issueHttpToken(secret) {
    const randomPart = crypto.randomBytes(24).toString('hex');
    const timestamp = Date.now();
    const hmac = crypto.createHmac('sha256', secret).update(`${randomPart}:${timestamp}`).digest('hex').substring(0, 24);
    const token = `${HTTP_TOKEN_PREFIX}${timestamp}_${randomPart}_${hmac}`;

    _httpTokens.set(token, { createdAt: timestamp, lastSeen: timestamp });

    if (_httpTokens.size > 500) {
        const now = Date.now();
        for (const [key, val] of _httpTokens) {
            if (now - val.lastSeen > HTTP_TOKEN_TTL_MS) _httpTokens.delete(key);
        }
    }

    return token;
}

function _verifyHmac(token, secret) {
    if (!token || !token.startsWith(HTTP_TOKEN_PREFIX)) return false;

    const parts = token.substring(HTTP_TOKEN_PREFIX.length).split('_');
    if (parts.length < 3) return false;

    const timestamp = parseInt(parts[0], 10);
    if (isNaN(timestamp)) return false;
    if (Date.now() - timestamp > HTTP_TOKEN_TTL_MS) return false;

    const randomPart = parts[1];
    const expectedHmac = crypto.createHmac('sha256', secret).update(`${randomPart}:${timestamp}`).digest('hex').substring(0, 24);
    const actualHmac = parts.slice(2).join('_');

    if (typeof expectedHmac !== 'string' || typeof actualHmac !== 'string') return false;
    if (expectedHmac.length !== actualHmac.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(actualHmac))) return false;

    return true;
}

function validateHttpToken(token, secret) {
    if (!token || !token.startsWith(HTTP_TOKEN_PREFIX)) return false;

    const stored = _httpTokens.get(token);
    if (stored) {
        if (Date.now() - stored.lastSeen > HTTP_TOKEN_TTL_MS) {
            _httpTokens.delete(token);
            return false;
        }
        if (!_verifyHmac(token, secret)) return false;
        return true;
    }

    if (_verifyHmac(token, secret)) {
        const parts = token.substring(HTTP_TOKEN_PREFIX.length).split('_');
        const timestamp = parseInt(parts[0], 10);
        _httpTokens.set(token, { createdAt: timestamp, lastSeen: Date.now() });
        return true;
    }

    return false;
}

function touchHttpToken(token) {
    const stored = _httpTokens.get(token);
    if (stored) {
        stored.lastSeen = Date.now();
    }
}

function shouldRenewToken(token) {
    const stored = _httpTokens.get(token);
    if (!stored) return false;
    return Date.now() - stored.lastSeen > HTTP_TOKEN_RENEW_THRESHOLD_MS;
}

function createAuthMiddleware(options = {}) {
    const secret = options.secret || '';
    const enabled = options.enabled === false ? false : true;
    const publicPaths = new Set(options.publicPaths || ['/api/health', '/api/version', '/api/license/status', '/api/license/activate', '/api/license/trial', '/api/auth/token']);

    return function authMiddleware(req, res, next) {
        if (!enabled) return next();
        if (!secret) return next();

        // 非 API 路径（SPA 页面、静态资源）无需认证，直接放行
        if (!req.path.startsWith('/api/')) return next();

        if (publicPaths.has(req.path)) return next();

        if (req.path.startsWith('/api/health')) return next();

        if (req.path.startsWith('/api/license/')) return next();

        const authHeader = req.headers['authorization'];
        const bearerToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        const token = bearerToken || req.query?.token || '';
        if (!token) {
            return res.apiError(AUTH_ERROR.statusCode, 'Authentication required', 'AUTH_MISSING');
        }

        if (timingSafeEqual(token, secret)) {
            return next();
        }

        if (validateHttpToken(token, secret)) {
            touchHttpToken(token);

            if (shouldRenewToken(token)) {
                const newToken = issueHttpToken(secret);
                res.setHeader('X-Renewed-Token', newToken);
            }

            return next();
        }

        return res.apiError(FORBIDDEN.statusCode, 'Invalid authentication token', 'AUTH_INVALID');
    };
}

function getAuthStatus(secret) {
    return {
        enabled: !!secret,
        hint: secret ? 'configured' : 'not configured'
    };
}

module.exports = { createAuthMiddleware, getAuthStatus, issueHttpToken, validateHttpToken };
