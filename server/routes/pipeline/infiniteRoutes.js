const router = require('express').Router();
const pipeline = require('../../services/pipeline');
const { startInfinitePipeline } = require('../../middleware/validators');
const logger = require('../../shared/logger');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, CONFLICT, INTERNAL_ERROR } = ERROR_CODES;

router.post('/', startInfinitePipeline, async (req, res) => {
    try {
        const { projectId, chaptersPerBatch, maxSupplements, stopAfterChapter, maxRounds } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);

        const store = require('../../store');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const existingState = await pipeline.getInfinitePipelineStatus(projectId);
        if (existingState.running) {
            return res.apiError(CONFLICT.statusCode, '该项目已有无限流水线在运行中', CONFLICT.code);
        }
        if (existingState._zombieDetected) {
            await pipeline.forceResetPipeline(projectId);
        }

        pipeline.runInfinitePipeline(projectId, { chaptersPerBatch, maxSupplements, stopAfterChapter, maxRounds })
            .then(result => {
                logger.info('[PIPELINE] Infinite pipeline completed:', result?.completedChapters, 'chapters');
            })
            .catch(err => {
                logger.error('[PIPELINE] Infinite pipeline error:', err.message);
            });
        res.json({ success: true, message: 'Infinite pipeline started' });
    } catch (error) {
        logger.error('[PIPELINE ROUTE] /infinite error:', error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/stop', async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    try {
        const result = await pipeline.stopInfinitePipeline(projectId);
        res.json(result);
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.post('/reset', async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    try {
        const result = await pipeline.forceResetPipeline(projectId);
        res.json(result);
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/status/:projectId', async (req, res) => {
    try {
        const result = await pipeline.getInfinitePipelineStatus(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code, { running: false });
    }
});

module.exports = router;
