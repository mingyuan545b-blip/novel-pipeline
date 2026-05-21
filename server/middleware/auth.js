const crypto = require('crypto');

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) {
        crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function createAuthMiddleware(options = {}) {
    const secret = options.secret || '';
    const enabled = options.enabled === false ? false : true;
    const publicPaths = new Set(options.publicPaths || ['/api/health', '/api/version', '/api/license/status', '/api/license/activate', '/api/license/trial']);

    return function authMiddleware(req, res, next) {
        if (!enabled) return next();
        if (!secret) return next();

        if (publicPaths.has(req.path)) return next();

        if (req.path.startsWith('/api/license/')) return next();

        const authHeader = req.headers['authorization'];
        const bearerToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

        const token = bearerToken || '';

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_MISSING'
            });
        }

        if (!timingSafeEqual(token, secret)) {
            return res.status(403).json({
                error: 'Invalid authentication token',
                code: 'AUTH_INVALID'
            });
        }

        next();
    };
}

function getAuthStatus(secret) {
    return {
        enabled: !!secret,
        hint: secret ? 'configured' : 'not configured'
    };
}

module.exports = { createAuthMiddleware, getAuthStatus };
