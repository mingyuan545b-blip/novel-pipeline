/**
 * maintenanceRoutes — 库维护（一键扫描/清理孤儿数据）
 *
 * 挂载：/api/maintenance（受全局鉴权保护，与其它 /api 路由一致）
 * 用法：
 *   GET  /api/maintenance/orphans                      扫描（默认只读）
 *   POST /api/maintenance/orphans/clean                清理（可选 body.keepProjectIds）
 *   GET  /api/maintenance/runtime                      运行时预警快照（LLM超时/卡死任务）
 *   GET  /api/maintenance/budget/:projectId            项目预算体检（累计消耗/限额/状态）
 *   PUT  /api/maintenance/budget/:projectId            设置项目预算限额（硬停开关）
 */
const logger = require('../shared/logger');
const router = require('express').Router();
const { ERROR_CODES } = require('../shared/errorCodes');

const { INTERNAL_ERROR, NOT_FOUND } = ERROR_CODES;

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

/**
 * 项目预算体检：累计消耗 / 限额 / 状态（ok|warn|exceeded|unlimited|disabled）
 * 数据源：project-spend（累计账）+ projects.budget（项目级覆盖全局默认）
 */
router.get('/budget/:projectId', async (req, res) => {
    try {
        const projectBudget = require('../services/pipeline/projectBudget');
        res.json({ success: true, data: await projectBudget.checkProjectBudget(req.params.projectId) });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 设置项目预算限额（tokenLimit/costLimitCny/warnRatio/enabled/hardStop，均局部覆盖） */
router.put('/budget/:projectId', async (req, res) => {
    try {
        const store = require('../store');
        const { projectId } = req.params;
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const body = req.body || {};
        const budget = Object.assign({}, project.budget);
        for (const k of ['tokenLimit', 'costLimitCny', 'warnRatio']) {
            if (body[k] !== undefined) budget[k] = Number(body[k]) || 0;
        }
        for (const k of ['enabled', 'hardStop']) {
            if (body[k] !== undefined) budget[k] = Boolean(body[k]);
        }
        await store.updateItem('projects', projectId, (cur) => Object.assign({}, cur, { budget }));
        const projectBudget = require('../services/pipeline/projectBudget');
        res.json({ success: true, data: await projectBudget.checkProjectBudget(projectId) });
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
