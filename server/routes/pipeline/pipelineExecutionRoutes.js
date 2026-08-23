const logger = require('../../shared/logger');
const router = require('express').Router();
const pipeline = require('../../services/pipeline');
const fpModule = require('../../services/pipeline/fullPipeline');
const { startPipeline, pipelineStep, generateMaterials, generateOutlines } = require('../../middleware/validators');
const { LLM_DEFAULTS } = require('../../config/systemConfig');
const { isLLMOverloaded } = require('../../shared/errors');
const asyncTaskManager = require('./asyncTaskManager');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.post('/step', pipelineStep, async (req, res) => {
    try {
        const { projectId, chapterId, step, round, context } = req.body;
        if (!projectId || !chapterId || !step) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, chapterId, and step are required', VALIDATION_ERROR.code);
        }
        const result = await pipeline.runPipelineStep(projectId, chapterId, step, round || 1, context || {});
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/full', startPipeline, async (req, res) => {
    try {
        const { projectId, chapterId, maxRounds } = req.body;
        if (!projectId || !chapterId) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and chapterId are required', VALIDATION_ERROR.code);
        }

        const store = require('../../store');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const chapter = await store.getItem('chapters', chapterId);
        if (!chapter) return res.apiError(NOT_FOUND.statusCode, '章节不存在', NOT_FOUND.code);

        const taskId = asyncTaskManager.createTask('task');

        const runWithRetry = async (attempt = 0) => {
            try {
                fpModule.setRunPipelineStepFn(pipeline.runPipelineStep);
                const result = await fpModule.runFullPipeline(projectId, chapterId, maxRounds || 3);
                asyncTaskManager.updateTask(taskId, {
                    status: result.success ? 'completed' : 'failed',
                    result,
                    error: result.success ? null : (result.error || result.message || 'Pipeline执行失败'),
                    completedAt: Date.now()
                });
            } catch (err) {
                if (isLLMOverloaded(err) && attempt < LLM_DEFAULTS.maxRetries) {
                    const delay = LLM_DEFAULTS.overloadedWaitMs * (attempt + 1);
                    logger.info('pipelineExecutionRou', `[PIPELINE ROUTE] Full pipeline failed (attempt ${attempt + 1}/${LLM_DEFAULTS.maxRetries}), retrying in ${delay / 1000}s...`);
                    asyncTaskManager.updateTask(taskId, { progress: `服务繁忙，第${attempt + 1}次重试中...` });
                    await new Promise(r => setTimeout(r, delay));
                    return runWithRetry(attempt + 1);
                }
                asyncTaskManager.updateTask(taskId, {
                    status: 'failed',
                    error: err.message,
                    completedAt: Date.now()
                });
            }
        };
        runWithRetry();

        res.json({ success: true, taskId, message: 'Pipeline task started' });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/generate-materials', generateMaterials, async (req, res) => {
    try {
        const { projectId, prompt } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        const result = await pipeline.generateInitialMaterials(projectId, prompt || '');
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/generate-outlines', generateOutlines, async (req, res) => {
    try {
        const { projectId, prompt, targetChapters } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        const MAX_RHYTHM_RETRIES = 3;
        let result;
        for (let attempt = 1; attempt <= MAX_RHYTHM_RETRIES; attempt++) {
            result = await pipeline.generateChapterOutlines(projectId, prompt || '', targetChapters ?? null);
            if (result.rhythmIssues) {
                logger.warn('pipelineExecutionRou', `[PIPELINE ROUTE] 卷节奏校验失败(尝试${attempt}/${MAX_RHYTHM_RETRIES}):`, result.rhythmIssues.join('; '));
                if (attempt < MAX_RHYTHM_RETRIES) continue;
            } else {
                break;
            }
        }
        res.json(result);
    } catch (error) {
        logger.error('pipelineExecutionRou', '[PIPELINE ROUTE] generate-outlines error:', error.stack || error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/supplement-outlines', async (req, res) => {
    try {
        const { projectId, supplementCount } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        const chapters = await require('../../store').queryItems('chapters', { projectId });
        const existingCount = chapters.length > 0 ? Math.max(...chapters.map(c => c.chapterNumber || 0)) : 0;
        const result = await pipeline.supplementChapterOutlines(projectId, existingCount, supplementCount || 30);
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
