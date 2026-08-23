const router = require('express').Router();
const pipeline = require('../../services/pipeline');
const logger = require('../../shared/logger');
const { LLM_DEFAULTS } = require('../../config/systemConfig');
const { isLLMOverloaded } = require('../../shared/errors');
const asyncTaskManager = require('./asyncTaskManager');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

router.post('/generate-from-template', async (req, res) => {
    try {
        const template = req.body;
        if (!template.name || !template.genre) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'name and genre are required', VALIDATION_ERROR.code);
        }
        const taskId = asyncTaskManager.createTask('task');

        const tryGenerate = async (attempt = 0) => {
            attempt++;
            try {
                const result = await pipeline.generateFromTemplate(template);
                asyncTaskManager.updateTask(taskId, {
                    status: result.success ? 'completed' : 'failed',
                    result,
                    completedAt: Date.now()
                });
            } catch (err) {
                if (isLLMOverloaded(err) && attempt < LLM_DEFAULTS.maxRetries) {
                    const delay = LLM_DEFAULTS.overloadedWaitMs * attempt;
                    logger.info(`[PIPELINE ROUTE] generateFromTemplate failed (attempt ${attempt}/${LLM_DEFAULTS.maxRetries}), retrying in ${delay/1000}s...`);
                    asyncTaskManager.updateTask(taskId, { progress: `服务繁忙，第${attempt}次重试中，${delay/1000}秒后重试...` });
                    await new Promise(r => setTimeout(r, delay));
                    return tryGenerate(attempt);
                }
                asyncTaskManager.updateTask(taskId, {
                    status: 'failed',
                    error: err.message,
                    completedAt: Date.now()
                });
            }
        };
        tryGenerate();

        res.json({ success: true, taskId, message: 'Task started' });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
