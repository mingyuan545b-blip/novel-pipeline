const express = require('express');
const { ChapterAuditor } = require('../services/chapterAuditor');
const llm = require('../services/llm');
const pipeline = require('../services/pipeline');

const router = express.Router();

const batchTasks = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of batchTasks.entries()) {
        if (task.status !== 'running' && now - (task.completedAt || task.startedAt || now) > 30 * 60 * 1000) {
            batchTasks.delete(id);
        }
    }
}, 10 * 60 * 1000);

router.get('/audit/:projectId', (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const result = auditor.auditAll();
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] audit all error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/audit/:projectId/chapter/:chapterId', (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const result = auditor.getAudit(req.params.chapterId);
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] audit chapter error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/violations/:projectId/:type', (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const result = auditor.getViolationsByType(req.params.type);
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] violations by type error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/repair/:projectId/:chapterId', async (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { repairInstructions, provider, model, autoReview } = req.body || {};
        const options = {};
        if (provider) options.provider = provider;
        if (model) options.model = model;
        if (autoReview) options.autoReview = true;
        const result = await auditor.repairChapter(req.params.chapterId, repairInstructions, llm, options);
        if (!result.success) return res.status(400).json(result);
        console.log(`[AUDITOR] Repaired Ch${result.chapterNumber}: ${result.violationsFixed} violations fixed, ${result.violationsAfter} remaining, model: ${result.usedProvider}/${result.usedModel}`);
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] repair error:', err);
        res.status(500).json({ error: err.message });
    }
});

const repairRetryTasks = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of repairRetryTasks.entries()) {
        if (task.status !== 'running' && now - (task.completedAt || task.startedAt || now) > 30 * 60 * 1000) {
            repairRetryTasks.delete(id);
        }
    }
}, 10 * 60 * 1000);

router.post('/repair-retry/:projectId/:chapterId', async (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { repairInstructions, provider, model, maxRetries, autoReview, followUpPipeline } = req.body || {};

        const taskId = 'retry_' + Date.now();
        repairRetryTasks.set(taskId, {
            status: 'running',
            chapterId: req.params.chapterId,
            progress: [],
            result: null,
            startedAt: Date.now()
        });

        res.json({ taskId });

        const options = {
            provider,
            model,
            maxRetries: maxRetries || 10,
            autoReview: autoReview !== false,
            followUpPipeline: followUpPipeline !== false,
            onProgress: (progress) => {
                const task = repairRetryTasks.get(taskId);
                if (task) {
                    task.progress.push({ ...progress, timestamp: Date.now() });
                    task.currentPhase = progress.phase;
                    task.currentAttempt = progress.attempt;
                }
            },
            shouldCancel: () => {
                const task = repairRetryTasks.get(taskId);
                return task?.cancelled === true;
            }
        };

        try {
            const result = await auditor.repairWithRetry(req.params.chapterId, repairInstructions, llm, pipeline, options);
            const task = repairRetryTasks.get(taskId);
            if (task) {
                task.status = 'completed';
                task.result = result;
                task.completedAt = Date.now();
            }
            console.log(`[AUDITOR] Repair-retry Ch${result.chapterNumber}: ${result.attempts} attempts, allPassed=${result.allPassed}, pipeline=${!!result.pipelineResult}`);
        } catch (err) {
            const task = repairRetryTasks.get(taskId);
            if (task) {
                task.status = 'error';
                task.error = err.message;
                task.completedAt = Date.now();
            }
            console.error('[AUDITOR] repair-retry error:', err);
        }
    } catch (err) {
        console.error('[AUDITOR] repair-retry init error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/repair-retry/:taskId/status', (req, res) => {
    const task = repairRetryTasks.get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

router.post('/repair-retry/:taskId/cancel', (req, res) => {
    const task = repairRetryTasks.get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'running') return res.status(400).json({ error: 'Task not running' });
    task.cancelled = true;
    task.status = 'cancelled';
    task.completedAt = Date.now();
    console.log(`[AUDITOR] Task ${req.params.taskId} cancelled by user`);
    res.json({ success: true, message: 'Task cancelled' });
});

router.post('/batch-repair/:projectId', async (req, res) => {
    try {
        const { chapterIds, provider, model, maxRetries, autoReview, followUpPipeline } = req.body || {};
        if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) {
            return res.status(400).json({ error: 'chapterIds required' });
        }

        const taskId = 'batch_' + Date.now();
        batchTasks.set(taskId, {
            status: 'running',
            total: chapterIds.length,
            completed: 0,
            results: [],
            startedAt: Date.now()
        });

        res.json({ taskId, total: chapterIds.length });

        const auditor = new ChapterAuditor(req.params.projectId);
        const options = {
            provider,
            model,
            maxRetries: maxRetries || 10,
            autoReview: autoReview !== false,
            followUpPipeline: followUpPipeline !== false,
            onProgress: (progress) => {
                const task = batchTasks.get(taskId);
                if (task) {
                    task.currentProgress = progress;
                }
            }
        };

        for (let i = 0; i < chapterIds.length; i++) {
            const chapterId = chapterIds[i];
            const task = batchTasks.get(taskId);
            if (!task || task.status === 'cancelled') break;

            task.currentChapter = i + 1;
            task.currentChapterId = chapterId;

            try {
                const result = await auditor.repairWithRetry(chapterId, '', llm, pipeline, options);
                task.results.push({
                    chapterId,
                    chapterNumber: result.chapterNumber,
                    success: result.success,
                    allPassed: result.allPassed,
                    attempts: result.attempts,
                    violationsAfter: result.violationsAfter,
                    pipelineSuccess: result.pipelineResult?.success,
                    error: result.error
                });
            } catch (err) {
                task.results.push({ chapterId, success: false, error: err.message });
            }

            task.completed = i + 1;
        }

        const task = batchTasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.completedAt = Date.now();
        }
    } catch (err) {
        console.error('[AUDITOR] batch-repair error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/batch-repair/:taskId/status', (req, res) => {
    const task = batchTasks.get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
});

router.post('/review/:projectId/:chapterId', async (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const { provider, model } = req.body || {};
        const apiConfig = (provider && model) ? auditor._buildApiConfig(provider, model) : undefined;
        const result = await auditor.reviewChapter(req.params.chapterId, llm, apiConfig);
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] review error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/models', (req, res) => {
    const models = [];
    if (process.env.MINIMAX_API_KEY) {
        models.push({
            provider: 'minimax',
            model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
            label: `MiniMax (${process.env.MINIMAX_MODEL || 'MiniMax-M2.7'})`,
            isDefault: true
        });
    }
    if (process.env.ALIYUN_CODING_API_KEY) {
        models.push({
            provider: 'aliyunCoding',
            model: process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus',
            label: `阿里云百炼 (${process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus'})`,
            isDefault: !process.env.MINIMAX_API_KEY
        });
    }
    if (process.env.LLM_PROVIDER === 'lmstudio') {
        models.push({
            provider: 'lmstudio',
            model: process.env.LMSTUDIO_MODEL || 'default',
            label: `LM Studio (${process.env.LMSTUDIO_MODEL || 'default'})`,
            isDefault: !process.env.MINIMAX_API_KEY && !process.env.ALIYUN_CODING_API_KEY
        });
    }
    res.json(models);
});

router.post('/rollback/:projectId/:snapshotId', (req, res) => {
    try {
        const auditor = new ChapterAuditor(req.params.projectId);
        const result = auditor.rollbackRepair(req.params.snapshotId);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        console.error('[AUDITOR] rollback error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
