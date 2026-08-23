const express = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { loadKeys, saveKeys, generateKey, redactKey } = require('./apiKeyStore');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const router = express.Router();

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.apiError(VALIDATION_ERROR.statusCode, '输入验证失败', VALIDATION_ERROR.code, { details: errors.array() });
    }
    next();
}

router.get('/api-keys', (req, res) => {
    try {
        const data = loadKeys();
        const keys = data.keys.map(k => ({
            id: k.id, name: k.name, key: redactKey(k.key),
            permissions: k.permissions, createdAt: k.createdAt,
            lastUsed: k.lastUsed, isActive: k.isActive
        }));
        res.json({ success: true, data: { keys, total: keys.length } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/api-keys', [
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    handleValidation
], (req, res) => {
    try {
        const { name, permissions = ['read'], isActive = true } = req.body;
        if (!name || name.length < 2) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'Name must be at least 2 characters', VALIDATION_ERROR.code);
        }
        const data = loadKeys();
        const newKey = {
            id: crypto.randomUUID(), name, key: generateKey(),
            permissions, isActive, createdAt: new Date().toISOString(), lastUsed: null
        };
        data.keys.push(newKey);
        saveKeys(data);
        res.apiOk(
            { id: newKey.id, name: newKey.name, key: newKey.key, permissions: newKey.permissions, createdAt: newKey.createdAt },
            { message: 'API key created. Save this key securely, it cannot be retrieved again.' },
            201
        );
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.delete('/api-keys/:id', [
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('id格式无效'),
    handleValidation
], (req, res) => {
    try {
        const { id } = req.params;
        const data = loadKeys();
        const idx = data.keys.findIndex(k => k.id === id);
        if (idx === -1) return res.apiError(NOT_FOUND.statusCode, 'API key not found', NOT_FOUND.code);
        const removed = data.keys.splice(idx, 1)[0];
        saveKeys(data);
        res.json({ success: true, message: `API key "${removed.name}" deleted` });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/api-keys/:id/rotate', [
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('id格式无效'),
    handleValidation
], (req, res) => {
    try {
        const { id } = req.params;
        const data = loadKeys();
        const key = data.keys.find(k => k.id === id);
        if (!key) return res.apiError(NOT_FOUND.statusCode, 'API key not found', NOT_FOUND.code);
        key.key = generateKey();
        key.lastRotated = new Date().toISOString();
        saveKeys(data);
        res.json({
            success: true,
            data: { id: key.id, name: key.name, key: key.key, lastRotated: key.lastRotated },
            message: 'API key rotated. Save this key securely, it cannot be retrieved again.'
        });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/api-keys/:id/toggle', [
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('id格式无效'),
    handleValidation
], (req, res) => {
    try {
        const { id } = req.params;
        const data = loadKeys();
        const key = data.keys.find(k => k.id === id);
        if (!key) return res.apiError(NOT_FOUND.statusCode, 'API key not found', NOT_FOUND.code);
        key.isActive = !key.isActive;
        saveKeys(data);
        res.json({ success: true, data: { id: key.id, isActive: key.isActive } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
