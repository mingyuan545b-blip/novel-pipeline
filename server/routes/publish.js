const express = require('express');
const router = express.Router();
const publish = require('../services/publish');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.use(require('./publishQueueRoutes'));
router.use(require('./publishPlatformRoutes'));

router.get('/platforms', (req, res) => { res.json(publish.getPlatforms()); });
router.get('/platforms/:id', (req, res) => { res.json(publish.getPlatform(req.params.id) || {}); });
router.get('/accounts', (req, res) => { res.json(publish.getPlatformAccounts()); });

router.post('/accounts', (req, res) => {
    const account = publish.addPlatformAccount(req.body);
    res.json(account);
});

router.put('/accounts/:id', (req, res) => {
    const updated = publish.updatePlatformAccount(req.params.id, req.body);
    if (!updated) return res.apiError(NOT_FOUND.statusCode, 'Account not found', NOT_FOUND.code);
    res.json(updated);
});

router.delete('/accounts/:id', (req, res) => {
    publish.deletePlatformAccount(req.params.id);
    res.json({ success: true });
});

router.post('/accounts/:id/verify', async (req, res) => {
    try { res.json(await publish.verifyPlatformAccount(req.params.id)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

module.exports = router;
