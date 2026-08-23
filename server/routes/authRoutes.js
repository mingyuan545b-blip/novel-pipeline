const router = require('express').Router();
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const { issueHttpToken, validateHttpToken } = require('../middleware/auth');
const { ERROR_CODES } = require('../shared/errorCodes');

const { AUTH_ERROR, FORBIDDEN } = ERROR_CODES;

router.post('/token', (req, res) => {
    const { secret } = req.body || {};
    if (!REQUEST_SECRET) {
        return res.json({ token: '', mode: 'open' });
    }
    if (secret && secret === REQUEST_SECRET) {
        const token = issueHttpToken(REQUEST_SECRET);
        return res.json({ token, expiresIn: 86400 });
    }
    return res.apiError(FORBIDDEN.statusCode, 'Invalid secret', 'AUTH_INVALID');
});

router.post('/ws-ticket', (req, res) => {
    if (!REQUEST_SECRET) {
        return res.json({ ticket: '' });
    }
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
    if (!bearerToken) {
        return res.apiError(AUTH_ERROR.statusCode, 'Authentication required', 'AUTH_MISSING');
    }
    if (bearerToken === REQUEST_SECRET || validateHttpToken(bearerToken, REQUEST_SECRET)) {
        const { issueTicket } = require('../services/websocket');
        const ticket = issueTicket(REQUEST_SECRET);
        return res.json({ ticket });
    }
    return res.apiError(FORBIDDEN.statusCode, 'Invalid authentication token', 'AUTH_INVALID');
});

module.exports = router;
