const logger = require('../shared/logger');
const express = require('express');
const { PromptOptimizer, PROBLEM_PATTERNS, OPTIMIZER_LIMITS } = require('../services/promptOptimizer');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

const router = express.Router();

router.get('/patterns/:projectId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const lastN = parseInt(req.query.lastNChapters) || 10;
        const result = optimizer.detectProblemPatterns(lastN);
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] detect error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/report/:projectId', async (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const lastN = parseInt(req.query.lastNChapters) || 10;
        const result = await optimizer.getFullReport(lastN);
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] report error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/suggestion/:projectId/:patternId', async (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = await optimizer.generateSuggestion(req.params.patternId);
        if (result.error) return res.apiError(VALIDATION_ERROR.statusCode, result.error, VALIDATION_ERROR.code, result);
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] suggestion error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.post('/apply/:projectId/:patternId', async (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const { suggestionIndex, customModification } = req.body || {};
        const result = await optimizer.applyOptimization(req.params.patternId, suggestionIndex || 0, customModification);
        if (!result.success) return res.apiError(VALIDATION_ERROR.statusCode, result.error || '操作失败', VALIDATION_ERROR.code, result);
        logger.info('optimizer', `[OPTIMIZER] Applied optimization: pattern=${req.params.patternId}, tokenDelta=${result.tokenDelta}, health=${result.healthScoreAfter}`);
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] apply error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.post('/rollback/:projectId/:snapshotId', async (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = await optimizer.rollback(req.params.snapshotId);
        if (!result.success) return res.apiError(VALIDATION_ERROR.statusCode, result.error || '操作失败', VALIDATION_ERROR.code, result);
        logger.info('optimizer', `[OPTIMIZER] Rolled back snapshot: ${req.params.snapshotId}, field=${result.field}`);
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] rollback error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/history/:projectId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = optimizer.getOptimizationHistory();
        res.json(result);
    } catch (err) {
        logger.error('optimizer', '[OPTIMIZER] history error:', err);
        return res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/limits', (req, res) => {
    res.json({ limits: OPTIMIZER_LIMITS, patterns: PROBLEM_PATTERNS.map(p => ({ id: p.id, category: p.category, targetField: p.targetField })) });
});

module.exports = router;
