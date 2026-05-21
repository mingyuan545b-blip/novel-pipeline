const express = require('express');
const { PromptOptimizer, PROBLEM_PATTERNS, OPTIMIZER_LIMITS } = require('../services/promptOptimizer');

const router = express.Router();

router.get('/patterns/:projectId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const lastN = parseInt(req.query.lastNChapters) || 10;
        const result = optimizer.detectProblemPatterns(lastN);
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] detect error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/report/:projectId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const lastN = parseInt(req.query.lastNChapters) || 10;
        const result = optimizer.getFullReport(lastN);
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] report error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/suggestion/:projectId/:patternId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = optimizer.generateSuggestion(req.params.patternId);
        if (result.error) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] suggestion error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/apply/:projectId/:patternId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const { suggestionIndex, customModification } = req.body || {};
        const result = optimizer.applyOptimization(req.params.patternId, suggestionIndex || 0, customModification);
        if (!result.success) return res.status(400).json(result);
        console.log(`[OPTIMIZER] Applied optimization: pattern=${req.params.patternId}, tokenDelta=${result.tokenDelta}, health=${result.healthScoreAfter}`);
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] apply error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/rollback/:projectId/:snapshotId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = optimizer.rollback(req.params.snapshotId);
        if (!result.success) return res.status(400).json(result);
        console.log(`[OPTIMIZER] Rolled back snapshot: ${req.params.snapshotId}, field=${result.field}`);
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] rollback error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/history/:projectId', (req, res) => {
    try {
        const optimizer = new PromptOptimizer(req.params.projectId);
        const result = optimizer.getOptimizationHistory();
        res.json(result);
    } catch (err) {
        console.error('[OPTIMIZER] history error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/limits', (req, res) => {
    res.json({ limits: OPTIMIZER_LIMITS, patterns: PROBLEM_PATTERNS.map(p => ({ id: p.id, category: p.category, targetField: p.targetField })) });
});

module.exports = router;
