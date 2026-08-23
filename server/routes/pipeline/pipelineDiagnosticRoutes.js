const router = require('express').Router();
const { diagnose, fullDiagnose } = require('../../services/pipeline/pipelinePreflight');
const { getContractSummary, getDataFlowSpec, getDataFlowGraph } = require('../../services/pipeline/pipelineContract');
const { getErrorsByStep } = require('../../services/pipeline/pipelineErrors');
const { getOutputContractSummary } = require('../../services/pipeline/pipelineOutputContract');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/preflight/diagnose', async (req, res) => {
    try {
        const { projectId, step } = req.query;
        if (!projectId || !step) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and step are required', VALIDATION_ERROR.code);
        }
        const store = require('../../store');
        const { resolveGenreFromProject } = require('../../services/genreConfig');
        const { resolveConfig } = require('../../config');
        const materialIndex = require('../../services/materialIndex');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const genre = resolveGenreFromProject(project);
        const config = resolveConfig(genre, project);
        const chapters = await store.queryItems('chapters', { projectId });
        const chapter = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)[0];
        const materialsRaw = await materialIndex.getMaterialsForScene(projectId, '主世界', 1);
        const materials = Array.isArray(materialsRaw) ? materialsRaw : [];
        const result = diagnose(step, { materials, chapter, project, config, genre, memoryError: null });
        res.json({ step, projectId, checks: result.results, passed: result.passed, failedChecks: result.failedChecks });
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

router.get('/preflight/contracts', (req, res) => {
    res.json(getContractSummary());
});

router.get('/preflight/errors', (req, res) => {
    const { step } = req.query;
    if (step) return res.json(getErrorsByStep(step));
    const { PIPELINE_ERROR_CODES } = require('../../services/pipeline/pipelineErrors');
    res.json(PIPELINE_ERROR_CODES);
});

router.get('/dataflow/spec', (req, res) => {
    const { step } = req.query;
    if (step) {
        const spec = getDataFlowSpec(step);
        if (!spec) return res.apiError(NOT_FOUND.statusCode, `Step "${step}" not found in DATA_FLOW_SPEC`, NOT_FOUND.code);
        return res.json(spec);
    }
    res.json(getDataFlowGraph());
});

router.get('/dataflow/graph', (req, res) => {
    res.json(getDataFlowGraph());
});

router.get('/output-contracts', (req, res) => {
    res.json(getOutputContractSummary());
});

router.get('/full-diagnose', async (req, res) => {
    try {
        const { projectId, step, chapterId } = req.query;
        if (!projectId || !step) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and step are required', VALIDATION_ERROR.code);
        }
        const store = require('../../store');
        const { resolveGenreFromProject } = require('../../services/genreConfig');
        const { resolveConfig } = require('../../config');
        const materialIndex = require('../../services/materialIndex');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const genre = resolveGenreFromProject(project);
        const config = resolveConfig(genre, project);

        let chapter = null;
        if (chapterId) chapter = await store.getItem('chapters', chapterId);
        if (!chapter) {
            const chapters = await store.queryItems('chapters', { projectId });
            chapter = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber)[0];
        }

        const materialsRaw = await materialIndex.getMaterialsForScene(projectId, '主世界', chapter?.chapterNumber || 1);
        const materials = Array.isArray(materialsRaw) ? materialsRaw : [];
        const materialNames = materials.map(m => ({ name: m.name, type: m.type, content: m.currentContent || m.initialContent || '' }));

        const inputContext = { materials, chapter, project, config, genre, memoryError: null };
        const result = fullDiagnose(step, inputContext, chapter, { materialNames, materials });
        res.json(result);
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, err.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
