/**
 * crudRoutes - 项目CRUD路由
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { createProject, updateProject } = require('../../middleware/validators');
const { resolveGenreFromProject } = require('../../services/genreConfig');
const { resolveConfig } = require('../../config');
const { createProjectData } = require('./projectCreateHandler');
const { verifyProject } = require('./projectCreateVerify');
const auditLog = require('../../services/auditLog');
const { cascadeDeleteProject } = require('./projectDeleteHandler');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

function _buildPipelineConfig(project) {
    const genre = resolveGenreFromProject(project);
    const config = resolveConfig(genre, project);
    return {
        skipSecondReview: config.flow.skipSecondReview,
        readerTriggers: config.reader.triggers || [],
        steps: config.flow.skipSecondReview
            ? ['writer', 'fast-review', 'final-editor']
            : ['writer', 'first-review', 'second-review', 'final-editor']
    };
}

function registerCrudRoutes(router) {
    router.get('/constraints', async (req, res) => {
        const presets = await store.listItems('constraint-presets');
        res.json(presets.map(p => ({ id: p.id, label: p.label, desc: p.desc || p.description || '' })));
    });

    router.get('/', async (req, res) => {
        const projects = await store.listItems('projects');
        // 按createdAt降序排序（最新的在前），无createdAt的排到最后
        projects.sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
        });
        res.json(projects.map(p => ({ ...p, pipelineConfig: _buildPipelineConfig(p) })));
    });

    router.get('/:id/pipeline-config', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        try {
            res.json(_buildPipelineConfig(project));
        } catch (e) {
            logger.error('crudRoutes', 'buildPipelineConfig error:', { errorMessage: e.message });
            res.apiError(INTERNAL_ERROR.statusCode, 'Failed to build pipeline config', INTERNAL_ERROR.code, { message: e.message });
        }
    });

    router.get('/:id/genre-constraints', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        try {
            const genre = resolveGenreFromProject(project);
            if (!genre) return res.json({ genreId: null, constraints: [], reviewFocus: null, behaviorTemplate: null });
            res.json({
                genreId: genre.id, genreLabel: genre.label,
                reviewFocus: genre.reviewFocus || genre.styleProfile?.reviewFocus || null,
                behaviorTemplate: genre.characterProfile?.behaviorTemplate || null,
                constraintPresets: genre.constraintPresets || {},
                requiredConstraints: genre.requiredConstraints || [],
                foundationConstraints: (genre.foundation?.additionalConstraints || []).map(c => ({ id: c.id, label: c.label, desc: c.desc })),
            });
        } catch (e) {
            logger.error('crudRoutes', 'genre-constraints error:', { errorMessage: e.message });
            res.apiError(INTERNAL_ERROR.statusCode, 'Failed to get genre constraints', INTERNAL_ERROR.code, { message: e.message });
        }
    });

    router.get('/:id/agent-model-config', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        res.json(project.agentModelConfig || {});
    });

    router.put('/:id/agent-model-config', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const config = req.body || {};
        const updated = { ...project, agentModelConfig: config, updatedAt: new Date().toISOString() };
        await store.setItem('projects', project.id, updated);
        res.json(config);
    });

    router.get('/:id', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        let pipelineConfig = {};
        try { pipelineConfig = _buildPipelineConfig(project); } catch (e) { logger.error('crudRoutes', 'buildPipelineConfig error:', { errorMessage: e.message }); }
        res.json({ ...project, pipelineConfig });
    });

    router.post('/', createProject, async (req, res) => {
        const project = createProjectData(req);
        await store.setItem('projects', project.id, project);
        auditLog.log(auditLog.ACTIONS.PROJECT_CREATE, { projectId: project.id, summary: `Created project "${project.name}"`, metadata: { genre: project.genre, mode: project.mode } });
        // 创建后自动验证
        const verification = await verifyProject(project.id);
        res.apiOk({ ...project, _verification: verification }, null, 201);
    });

    router.put('/:id', updateProject, async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const updated = { ...project, ...req.body, id: project.id, updatedAt: new Date().toISOString() };
        await store.setItem('projects', project.id, updated);
        res.json(updated);
    });

    router.delete('/:id', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const { deletedCounts, failedCounts } = await cascadeDeleteProject(req.params.id);
        auditLog.log(auditLog.ACTIONS.PROJECT_DELETE, { projectId: req.params.id, summary: `Deleted project "${project.name}"`, metadata: { deletedCounts, failedCounts } });
        res.json({ success: true, deletedCounts, failedCounts });
    });
}

module.exports = { registerCrudRoutes };
