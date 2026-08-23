const express = require('express');
const router = express.Router();
const store = require('../../store');
const { materialLifecycleService } = require('../../services/materialLifecycleService');
const { syncFactsFromMaterials } = require('../../services/knowledgeBase/factSync');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/material-lifecycle/:projectId/analysis', async (req, res) => {
    try {
        const { projectId } = req.params;
        const analysis = await materialLifecycleService.analyze(projectId);
        res.json({ analysis });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/material-lifecycle/:projectId/archive', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { materialIds, reason } = req.body || {};
        const result = await materialLifecycleService.archive(projectId, materialIds, reason);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/material-lifecycle/:projectId/duplicates', async (req, res) => {
    try {
        const { projectId } = req.params;
        const duplicates = await materialLifecycleService.findDuplicates(projectId);
        res.json({ duplicates });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/material-lifecycle/:projectId/budget', async (req, res) => {
    try {
        const { projectId } = req.params;
        const budget = await materialLifecycleService.getBudget(projectId);
        res.json({ budget });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/material-lifecycle/:projectId/health', async (req, res) => {
    try {
        const { projectId } = req.params;
        const health = await materialLifecycleService.getHealth(projectId);
        res.json({ health });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/sync-facts/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const materials = await store.queryItems('materials', { projectId });
        const synced = await syncFactsFromMaterials(projectId, materials);
        res.json({ success: true, synced });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/facts/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const facts = await store.queryItems('knowledge-facts', { projectId });
        res.json({ facts });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
