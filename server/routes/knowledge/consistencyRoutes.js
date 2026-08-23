const express = require('express');
const router = express.Router();
const consistency = require('../../services/consistency');
const { powerGuard } = require('../../services/powerGuard');
const { foreshadowGuard } = require('../../services/foreshadowGuard');
const { characterArcGuard } = require('../../services/characterArcGuard');
const { consistencyAuditService } = require('../../services/consistencyAuditService');
const store = require('../../store');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.post('/consistency/:projectId/check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, content } = req.body || {};
        const result = await consistency.checkConsistency(projectId, { chapterNumber, content });
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/consistency/:projectId/quick-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await consistency.quickCheck(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/consistency/:projectId/ai-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber } = req.body || {};
        const result = await consistency.aiCheck(projectId, chapterNumber);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/consistency/:projectId/reports', async (req, res) => {
    try {
        const { projectId } = req.params;
        const reports = await consistency.getReportHistory(projectId);
        res.json({ reports });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/power-guard/:projectId/check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await powerGuard.check(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/power-guard/:projectId/curve/:entityId', async (req, res) => {
    try {
        const { projectId, entityId } = req.params;
        const result = await powerGuard.getPowerCurve(projectId, entityId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/foreshadow-guard/:projectId/overdue', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await foreshadowGuard.getOverdue(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/foreshadow-guard/:projectId/stats', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await foreshadowGuard.getResolveStats(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/character-arc-guard/:projectId/check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await characterArcGuard.check(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/character-arc-guard/:projectId/activity', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await characterArcGuard.getActivity(projectId);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/consistency-audit/:projectId/run', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await consistencyAuditService.runAudit(projectId);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/consistency-audit/:projectId/history', async (req, res) => {
    try {
        const { projectId } = req.params;
        const history = await consistencyAuditService.getHistory(projectId);
        res.json({ history });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
