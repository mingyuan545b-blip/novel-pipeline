/**
 * maintenanceRoutes — 库维护（一键扫描/清理孤儿数据）
 *
 * 挂载：/api/maintenance（受全局鉴权保护，与其它 /api 路由一致）
 * 用法：
 *   GET  /api/maintenance/orphans                      扫描（默认只读）
 *   POST /api/maintenance/orphans/clean                清理（可选 body.keepProjectIds）
 *   GET  /api/maintenance/runtime                      运行时预警快照（LLM超时/卡死任务）
 */
const logger = require('../shared/logger');
const router = require('express').Router();
const { ERROR_CODES } = require('../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/orphans', async (req, res) => {
    try {
        const orphanCleanup = require('../services/orphanCleanup');
        const report = await orphanCleanup.scan();
        res.json({ success: true, data: report });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/orphans/clean', async (req, res) => {
    try {
        const keepProjectIds = Array.isArray(req.body?.keepProjectIds) ? req.body.keepProjectIds : [];
        const orphanCleanup = require('../services/orphanCleanup');
        const before = await orphanCleanup.scan({ keepProjectIds });
        const result = await orphanCleanup.clean({ keepProjectIds });
        logger.info('maintenance', `孤儿数据清理：删除 ${result.total} 行`, { total: result.total, deleted: result.deleted });
        res.json({ success: true, data: { scannedOrphans: before.total, deleted: result.total, byTable: result.deleted } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/runtime', (req, res) => {
    try {
        const llmStats = require('../services/llmTimeoutTracker').snapshot();
        const tasks = require('./pipeline/asyncTaskManager').snapshot();
        res.json({ success: true, data: { llm: llmStats, tasks } });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
