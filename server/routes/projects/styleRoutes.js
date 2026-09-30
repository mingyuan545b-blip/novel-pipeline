/**
 * styleRoutes - 风格相关路由
 */
const store = require('../../store');
const { analyzeStyle } = require('./styleAnalysis');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR, VALIDATION_ERROR } = ERROR_CODES;

function registerStyleRoutes(router) {
    router.post('/:id/analyze-style', async (req, res) => {
        try {
            const { id } = req.params;
            const { suggestion } = req.body;
            const project = await store.getItem('projects', id);
            if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

            const { fullGuidance, analysis } = await analyzeStyle(id, suggestion);
            project.styleGuidance = fullGuidance;
            project.styleGuidanceUpdatedAt = new Date().toISOString();
            await store.setItem('projects', id, project);
            res.json({ success: true, styleGuidance: fullGuidance, analysis });
        } catch (error) {
            res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
        }
    });

    router.put('/:id/style-guidance', async (req, res) => {
        const { id } = req.params;
        const { styleGuidance } = req.body;
        const project = await store.getItem('projects', id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        project.styleGuidance = styleGuidance;
        project.styleGuidanceUpdatedAt = new Date().toISOString();
        await store.setItem('projects', id, project);
        require('../../services/dataContext').resetDataContext(id);
        res.json({ success: true, styleGuidance });
    });

    router.post('/:id/remediate', async (req, res) => {
        try {
            const { id } = req.params;
            const { reviewText, autoApply } = req.body;
            if (!reviewText) return res.apiError(VALIDATION_ERROR.statusCode, 'reviewText is required', VALIDATION_ERROR.code);
            const reviewRemediation = require('../../services/reviewRemediation');
            const result = await reviewRemediation.analyzeAndRemediate(id, reviewText, { autoApply: autoApply !== false });
            res.json(result);
        } catch (error) {
            res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
        }
    });

    router.get('/:id/remediation-status', async (req, res) => {
        const { id } = req.params;
        const project = await store.getItem('projects', id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        res.json({
            writerRules: project.writerPromptAdditions || [],
            reviewRules: project.reviewPromptAdditions || [],
            constraints: project.constraints || [],
            styleGuidance: project.styleGuidance || null
        });
    });

    router.delete('/:id/remediation/:type', async (req, res) => {
        const { id, type } = req.params;
        const { index } = req.body;
        const project = await store.getItem('projects', id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        if (type === 'writer-rule' && project.writerPromptAdditions) {
            project.writerPromptAdditions.splice(index, 1);
        } else if (type === 'review-rule' && project.reviewPromptAdditions) {
            project.reviewPromptAdditions.splice(index, 1);
        } else if (type === 'style-guidance') {
            project.styleGuidance = '';
            project.styleGuidanceUpdatedAt = new Date().toISOString();
        }
        await store.setItem('projects', id, project);
        res.json({ success: true });
    });
}

module.exports = { registerStyleRoutes };
