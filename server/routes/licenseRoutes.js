const router = require('express').Router();
const license = require('../services/license');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR } = ERROR_CODES;

router.get('/status', (req, res) => {
    const membership = license.checkMembership();
    res.json(membership);
});

router.post('/activate', (req, res) => {
    const { key } = req.body;
    if (!key) return res.apiError(VALIDATION_ERROR.statusCode, 'License key is required', VALIDATION_ERROR.code);
    const result = license.activateLicense(key);
    if (result.valid) {
        res.json({ success: true, level: result.level, trial: result.trial, expiresAt: result.expiresAt });
    } else {
        res.apiError(VALIDATION_ERROR.statusCode, result.reason || 'Invalid license key', VALIDATION_ERROR.code);
    }
});

router.post('/deactivate', (req, res) => {
    license.deactivateLicense();
    res.json({ success: true });
});

router.post('/trial', (req, res) => {
    const trialKey = license.generateTrialKey();
    const result = license.activateLicense(trialKey);
    if (result.valid) {
        res.json({ success: true, key: trialKey, level: 'pro', trial: true, expiresAt: result.expiresAt });
    } else {
        res.apiError(VALIDATION_ERROR.statusCode, 'Failed to generate trial', VALIDATION_ERROR.code);
    }
});

module.exports = router;
