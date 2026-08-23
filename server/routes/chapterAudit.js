const logger = require('../shared/logger');
const { ChapterAuditor } = require('../services/chapterAuditor');
const llm = require('../services/llm');
const pipeline = require('../services/pipeline');
const { DEFAULT_MODEL } = require('../config/modelResolver');
const { handleRepairRetry, getRetryTaskStatus, cancelRetryTask } = require('./auditRetryHandler');
const { ERROR_CODES } = require('../shared/errorCodes');
const { projectIdParam, chapterIdParam } = require('../middleware/validators');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const batchTasks = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of batchTasks.entries()) {
        if (task.status !== 'running' && now - (task.completedAt || task.startedAt || now) > 30 * 60 * 1000) batchTasks.delete(id);
    }
}, 10 * 60 * 1000);

const router = require('express').Router();

router.get('/audit/:projectId', projectIdParam, (req, res) => {
    const auditor = new ChapterAuditor(req.params.projectId);
    const result = auditor.auditProject();
    res.json(result);
});

router.get('/audit/:projectId/chapter/:chapterId', projectIdParam, chapterIdParam, (req, res) => {
    const auditor = new ChapterAuditor(req.params.projectId);
    const result = auditor.auditChapter(req.params.chapterId);
    res.json(result);
});

router.get('/violations/:projectId/:type', projectIdParam, (req, res) => {
    const auditor = new ChapterAuditor(req.params.projectId);
    const result = auditor.getViolations(req.params.type);
    res.json(result);
});

router.post('/repair/:projectId/:chapterId', projectIdParam, chapterIdParam, async (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { repairInstructions, provider, model, autoReview } = req.body || {};
        const options = {};
        if (provider) options.provider = provider;
        if (model) options.model = model;
        if (autoReview) options.autoReview = true;
        const result = await auditor.repairChapter(req.params.chapterId, repairInstructions, llm, options);
        if (!result.success) return res.apiError(VALIDATION_ERROR.statusCode, result.error || '操作失败', VALIDATION_ERROR.code, result);
        logger.info('chapterAudit', `[AUDITOR] Repaired Ch${result.chapterNumber}: ${result.violationsFixed} fixed, ${result.violationsAfter} remaining`);
        res.json(result);
    } catch (err) { logger.error('chapterAudit', '[AUDITOR] repair error:', err); res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.post('/repair-retry/:projectId/:chapterId', projectIdParam, chapterIdParam, handleRepairRetry);

router.get('/repair-retry/:taskId/status', (req, res) => {
    const task = getRetryTaskStatus(req.params.taskId);
    if (!task) return res.apiError(NOT_FOUND.statusCode, 'Task not found', NOT_FOUND.code);
    res.json(task);
});

router.post('/repair-retry/:taskId/cancel', (req, res) => {
    const result = cancelRetryTask(req.params.taskId);
    if (!result) return res.apiError(NOT_FOUND.statusCode, 'Task not found', NOT_FOUND.code);
    if (result.error) return res.apiError(VALIDATION_ERROR.statusCode, result.error, VALIDATION_ERROR.code, result);
    logger.info('chapterAudit', `[AUDITOR] Task ${req.params.taskId} cancelled`);
    res.json(result);
});

router.post('/batch-repair/:projectId', projectIdParam, async (req, res) => {
    try {
        const { chapterIds, provider, model, maxRetries, autoReview, followUpPipeline } = req.body || {};
        if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) return res.apiError(VALIDATION_ERROR.statusCode, 'chapterIds required', VALIDATION_ERROR.code);
        const taskId = 'batch_' + Date.now();
        batchTasks.set(taskId, { status: 'running', total: chapterIds.length, completed: 0, results: [], startedAt: Date.now() });
        res.json({ taskId, total: chapterIds.length });

        const auditor = new ChapterAuditor(req.params.projectId);
        const options = { provider, model, maxRetries: maxRetries || 10, autoReview: autoReview !== false, followUpPipeline: followUpPipeline !== false, onProgress: (progress) => { const task = batchTasks.get(taskId); if (task) task.currentProgress = progress; } };

        for (let i = 0; i < chapterIds.length; i++) {
            const chapterId = chapterIds[i];
            const task = batchTasks.get(taskId);
            if (!task || task.status === 'cancelled') break;
            task.currentChapter = i + 1;
            task.currentChapterId = chapterId;
            try {
                const result = await auditor.repairWithRetry(chapterId, '', llm, pipeline, options);
                task.results.push({ chapterId, chapterNumber: result.chapterNumber, success: result.success, allPassed: result.allPassed, attempts: result.attempts, violationsAfter: result.violationsAfter, pipelineSuccess: result.pipelineResult?.success, error: result.error });
            } catch (err) { task.results.push({ chapterId, success: false, error: err.message }); }
            task.completed = i + 1;
        }
        const task = batchTasks.get(taskId);
        if (task) { task.status = 'completed'; task.completedAt = Date.now(); }
    } catch (err) { logger.error('chapterAudit', '[AUDITOR] batch-repair error:', err); res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/batch-repair/:taskId/status', (req, res) => {
    const task = batchTasks.get(req.params.taskId);
    if (!task) return res.apiError(NOT_FOUND.statusCode, 'Task not found', NOT_FOUND.code);
    res.json(task);
});

router.post('/review/:projectId/:chapterId', projectIdParam, chapterIdParam, async (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { provider, model } = req.body || {};
        const apiConfig = (provider && model) ? auditor._buildApiConfig(provider, model) : undefined;
        res.json(await auditor.reviewChapter(req.params.chapterId, llm, apiConfig));
    } catch (err) { logger.error('chapterAudit', '[AUDITOR] review error:', err); res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

router.get('/models', (req, res) => {
    const models = [];
    if (process.env.ALIYUN_CODING_API_KEY) models.push({ provider: 'aliyunCoding', model: process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL, label: `阿里云百炼 (${process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL})`, isDefault: true });
    res.json(models);
});

router.post('/rollback/:projectId/:snapshotId', projectIdParam, (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const result = auditor.rollbackRepair(req.params.snapshotId);
        if (!result.success) return res.apiError(VALIDATION_ERROR.statusCode, result.error || '操作失败', VALIDATION_ERROR.code, result);
        res.json(result);
    } catch (err) { logger.error('chapterAudit', '[AUDITOR] rollback error:', err); res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code); }
});

module.exports = router;
