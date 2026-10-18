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
        // 修复：引擎上不存在 checkConsistency()（原调用必抛 TypeError → 500）
        // 全维度校验对应引擎方法为 fullCheck(projectId, chapterNumber, chapterContent)
        const result = await consistency.fullCheck(projectId, Number(chapterNumber) || 0, content || '');
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/consistency/:projectId/quick-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent, content } = req.body || {};
        // 修复：原来只传 projectId，chapterNumber/chapterContent 丢失 → 正文恒为空
        // → checkCharacter/Power 恒返回 0 问题（"通过"是假象，等于没校验）
        const result = await consistency.quickCheck(projectId, Number(chapterNumber) || 0, chapterContent || content || '');
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/consistency/:projectId/ai-check', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, chapterContent, content } = req.body || {};
        // 修复：引擎方法名是 aiAssistedCheck（原调用 aiCheck 不存在 → 必抛 TypeError → 500）
        const result = await consistency.aiAssistedCheck(projectId, Number(chapterNumber) || 0, chapterContent || content || '');
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
        // 修复：服务方法名是 checkPowerConsistency（原调用 check 不存在 → 500）
        const result = await powerGuard.checkPowerConsistency(projectId, Number(req.query.currentChapter) || undefined);
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
        // 修复：服务方法名是 getOverdueForeshadows（原调用 getOverdue 不存在 → 500）
        const result = await foreshadowGuard.getOverdueForeshadows(projectId, Number(req.query.currentChapter) || undefined);
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
        // 修复：服务方法名是 checkCharacterArcs（原调用 check 不存在 → 500）
        const result = await characterArcGuard.checkCharacterArcs(projectId, Number(req.query.currentChapter) || undefined);
        res.json({ result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/character-arc-guard/:projectId/activity', async (req, res) => {
    try {
        const { projectId } = req.params;
        // 修复：服务方法名是 getCharacterActivityStats（原调用 getActivity 不存在 → 500）
        const result = await characterArcGuard.getCharacterActivityStats(projectId, Number(req.query.currentChapter) || undefined);
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
        // 修复：服务方法名是 getAuditHistory（原调用 getHistory 不存在 → 500）
        const history = await consistencyAuditService.getAuditHistory(projectId, Number(req.query.limit) || 10);
        res.json({ history });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
