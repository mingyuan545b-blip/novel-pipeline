const express = require('express');
const { loadKeys, saveKeys, hashKey } = require('./apiKeyStore');
const apiKeyRoutes = require('./apiKeyRoutes');
const { ERROR_CODES } = require('../shared/errorCodes');

const { AUTH_ERROR, FORBIDDEN, INTERNAL_ERROR } = ERROR_CODES;

const router = express.Router();

// Mount API key CRUD routes
router.use(apiKeyRoutes);

// --- Authentication Middleware ---
function authenticateApiKey(req, res, next) {
    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    if (!authHeader) {
        return res.apiError(AUTH_ERROR.statusCode, 'Missing API key', AUTH_ERROR.code);
    }

    const providedKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const providedHash = hashKey(providedKey);

    const data = loadKeys();
    const found = data.keys.find(k => {
        const keyHash = hashKey(k.key);
        return keyHash === providedHash;
    });

    if (!found) {
        return res.apiError(FORBIDDEN.statusCode, 'Invalid API key', FORBIDDEN.code);
    }

    if (!found.isActive) {
        return res.apiError(FORBIDDEN.statusCode, 'API key is inactive', FORBIDDEN.code);
    }

    found.lastUsed = new Date().toISOString();
    saveKeys(data);

    req.apiKey = {
        id: found.id,
        name: found.name,
        permissions: found.permissions
    };
    next();
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.apiKey || !req.apiKey.permissions.includes('*') && !req.apiKey.permissions.includes(permission)) {
            return res.apiError(FORBIDDEN.statusCode, `Missing permission: ${permission}`, FORBIDDEN.code);
        }
        next();
    };
}

// --- Admin Routes ---
router.get('/users', (req, res) => {
    try {
        const users = [
            { id: 'admin', name: 'Admin', role: 'admin', createdAt: new Date().toISOString(), isActive: true },
            { id: 'editor', name: 'Editor', role: 'editor', createdAt: new Date().toISOString(), isActive: true },
            { id: 'viewer', name: 'Viewer', role: 'viewer', createdAt: new Date().toISOString(), isActive: true }
        ];
        res.json({ success: true, data: { users, total: users.length } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/stats', (req, res) => {
    try {
        const healthMonitor = require('../platform/monitor/healthMonitor');
        const health = healthMonitor.getSystemHealth();
        const processInfo = healthMonitor.getProcessInfo();
        res.json({
            success: true,
            data: { system: health, process: processInfo, timestamp: new Date().toISOString() }
        });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/config/reload', (req, res) => {
    try {
        const config = require('../platform/config/system');
        const newConfig = config.reload();
        res.json({ success: true, message: 'Config reloaded', data: { loadTime: new Date(config.getLoadTime()).toISOString() } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = {
    router,
    authenticateApiKey,
    requirePermission,
    _hashKey: hashKey
};
