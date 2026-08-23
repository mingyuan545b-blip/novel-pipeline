const router = require('express').Router();
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { getAvailableProviders } = require('../config/providerRegistry');
const license = require('../services/license');
const metricsRoutes = require('./healthMetricsRoutes');
const { ERROR_CODES } = require('../shared/errorCodes');
const { INTERNAL_ERROR } = ERROR_CODES;

// 服务启动时间戳 — 模块加载时记录，用于版本校验
const SERVER_STARTED_AT = new Date().toISOString();
const SERVER_PID = process.pid;

// 挂载 /metrics 子路由（从 healthMetricsRoutes.js 加载）
router.use('/metrics', metricsRoutes);
// Q5: 挂载 /deep 子路由（深度依赖项检查：PG/memory/disk/persistence）
const healthDeepRoutes = require('./healthDeepRoutes');
router.use('/deep', healthDeepRoutes.router);


const { handleHealthSummary } = require('./healthSummaryHandler');
router.get('/', handleHealthSummary);


router.get('/alerts', (req, res) => {
    const healthMonitor = require('../services/healthMonitor');
    res.json(healthMonitor.getAlerts({
        level: req.query.level,
        category: req.query.category,
        limit: parseInt(req.query.limit) || 50
    }));
});

router.post('/check', (req, res) => {
    const healthMonitor = require('../services/healthMonitor');
    healthMonitor.runHealthCheck();
    res.json({ success: true, message: 'Health check triggered' });
});

// 陷阱#72防御：4类素材深度查询API（供前端告警面板调用）
// GET /api/health/material-depth?projectId=xxx
router.get('/material-depth', async (req, res) => {
    try {
        const { checkProjectMaterials, checkChapterMaterials } = require('../services/pipeline/materialDepthChecker');
        const projectId = req.query.projectId;
        const chapterNumber = req.query.chapterNumber ? parseInt(req.query.chapterNumber) : null;

        if (chapterNumber !== null) {
            const report = await checkChapterMaterials(projectId, chapterNumber);
            return res.json({ success: true, report });
        }
        const report = await checkProjectMaterials(projectId);
        res.json({ success: true, report });
    } catch (err) {
        res.apiError(500, 'Material depth check failed: ' + err.message, 'INTERNAL_ERROR');
    }
});

// --- Audit Log endpoints ---
const auditLog = require('../services/auditLog');

router.get('/audit', (req, res) => {
    const entries = auditLog.query({
        action: req.query.action,
        projectId: req.query.projectId,
        since: req.query.since,
        limit: parseInt(req.query.limit) || 50,
    });
    res.json({ success: true, count: entries.length, entries });
});

router.get('/audit/stats', (req, res) => {
    res.json({ success: true, stats: auditLog.getStats() });
});

// --- Schema Integrity & Field Consistency endpoints ---
const USE_PG = process.env.USE_PG === 'true';

router.get('/schema-check', async (req, res) => {
    if (!USE_PG) {
        return res.json({ success: true, message: 'Schema check only applicable for PG backend' });
    }
    try {
        const { checkSchemaIntegrity } = require('../db/schemaIntegrityCheck');
        const result = await checkSchemaIntegrity();
        res.json({ success: true, ...result });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/field-consistency/:projectId', async (req, res) => {
    if (!USE_PG) {
        return res.json({ success: true, message: 'Field consistency check only applicable for PG backend' });
    }
    try {
        const { checkFieldConsistency } = require('../db/schemaIntegrityCheck');
        const result = await checkFieldConsistency(req.params.projectId);
        res.json({ success: true, ...result });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
