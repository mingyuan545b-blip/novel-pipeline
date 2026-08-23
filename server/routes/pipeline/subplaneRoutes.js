const router = require('express').Router();
const logger = require('../../shared/logger');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.post('/generate-subplane-materials', async (req, res) => {
    try {
        const { projectId, genre, subplaneName, subplaneType, ipReference, volumeNumber } = req.body;
        if (!projectId || !subplaneName || !subplaneType) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, subplaneName, subplaneType 必填', VALIDATION_ERROR.code);
        }

        const store = require('../../store');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const llm = require('../../services/llm');
        const { buildSubplanePrompt } = require('./subplanePromptBuilder');
        const { saveSubplaneMaterials } = require('./subplaneSaver');

        const messages = buildSubplanePrompt({ project, subplaneName, subplaneType, ipReference, volumeNumber });
        const result = await llm.chat(messages, { temperature: 0.8, maxTokens: 16000 });

        let parsed;
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');
            parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
            return res.apiError(
                INTERNAL_ERROR.statusCode,
                '素材生成格式错误: ' + e.message,
                INTERNAL_ERROR.code,
                { raw: result.substring(0, 500) }
            );
        }

        const { subplaneId, createdMaterials } = await saveSubplaneMaterials({
            projectId, parsed, subplaneName, subplaneType, volumeNumber, project
        });

        res.json({ success: true, subplaneId, createdMaterials, count: createdMaterials.length, raw: parsed });
    } catch (error) {
        logger.error('[PIPELINE ROUTE] /generate-subplane-materials error:', error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/injection-map/:projectId', async (req, res) => {
    try {
        const store = require('../../store');
        const projectId = req.params.projectId;
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const pipeline = require('../../services/pipeline');
        const { buildInjectionMap } = require('./injectionMapBuilder');

        const chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const allMaterials = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
        const vis = pipeline.getVisibleMaterials(projectId, chapters.length + 1, { purpose: 'outline' });
        const volumeOrderConfig = pipeline.getVolumeOrder(projectId);

        const injectionMap = buildInjectionMap({
            project, chapters, allMaterials, vis, volumeOrderConfig, projectId
        });

        res.json(injectionMap);
    } catch (error) {
        logger.error('[PIPELINE ROUTE] /injection-map error:', error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
