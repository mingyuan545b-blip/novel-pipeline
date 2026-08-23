const logger = require('../shared/logger');
const { ChapterAuditor } = require('../services/chapterAuditor');
const llm = require('../services/llm');
const pipeline = require('../services/pipeline');
const { ERROR_CODES } = require('../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

const repairRetryTasks = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of repairRetryTasks.entries()) {
        if (task.status !== 'running' && now - (task.completedAt || task.startedAt || now) > 30 * 60 * 1000) {
            repairRetryTasks.delete(id);
        }
    }
}, 10 * 60 * 1000);

async function handleRepairRetry(req, res) {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { repairInstructions, provider, model, maxRetries, autoReview, followUpPipeline } = req.body || {};
        const taskId = 'retry_' + Date.now();
        repairRetryTasks.set(taskId, { status: 'running', chapterId: req.params.chapterId, progress: [], result: null, startedAt: Date.now() });
        res.json({ taskId });

        const options = {
            provider, model, maxRetries: maxRetries || 10,
            autoReview: autoReview !== false, followUpPipeline: followUpPipeline !== false,
            onProgress: (progress) => { const task = repairRetryTasks.get(taskId); if (task) { task.progress.push({ ...progress, timestamp: Date.now() }); task.currentPhase = progress.phase; task.currentAttempt = progress.attempt; } },
            shouldCancel: () => repairRetryTasks.get(taskId)?.cancelled === true
        };

        try {
            const result = await auditor.repairWithRetry(req.params.chapterId, repairInstructions, llm, pipeline, options);
            const task = repairRetryTasks.get(taskId);
            if (task) { task.status = 'completed'; task.result = result; task.completedAt = Date.now(); }
            logger.info('chapterAudit', `[AUDITOR] Repair-retry Ch${result.chapterNumber}: ${result.attempts} attempts, allPassed=${result.allPassed}`);
        } catch (err) {
            const task = repairRetryTasks.get(taskId);
            if (task) { task.status = 'error'; task.error = err.message; task.completedAt = Date.now(); }
            logger.error('chapterAudit', '[AUDITOR] repair-retry error:', err);
        }
    } catch (err) {
        logger.error('chapterAudit', '[AUDITOR] repair-retry init error:', err);
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
}

function getRetryTaskStatus(taskId) { return repairRetryTasks.get(taskId) || null; }

function cancelRetryTask(taskId) {
    const task = repairRetryTasks.get(taskId);
    if (!task) return null;
    if (task.status !== 'running') return { error: 'Task not running' };
    task.cancelled = true;
    task.status = 'cancelled';
    task.completedAt = Date.now();
    return { success: true };
}

module.exports = { repairRetryTasks, handleRepairRetry, getRetryTaskStatus, cancelRetryTask };
