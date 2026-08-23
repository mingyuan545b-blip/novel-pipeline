const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { ensureDefaults } = require('./styleTemplateDefaults');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

const router = require('express').Router();

// Initialize default styles on load
ensureDefaults();

// Merge analysis sub-routes
const analysisRoutes = require('./styleTemplateAnalysis');
router.use(analysisRoutes);

router.get('/templates', async (req, res) => {
    const { tag } = req.query;
    let templates = await store.listItems('style-templates');
    if (tag) templates = templates.filter(t => (t.tags || []).includes(tag));
    templates.sort((a, b) => (a.isDefault ? 0 : 1) - (b.isDefault ? 0 : 1));
    res.json(templates);
});

router.get('/templates/:id', async (req, res) => {
    const t = await store.getItem('style-templates', req.params.id);
    if (!t) return res.apiError(NOT_FOUND.statusCode, 'Style template not found', NOT_FOUND.code);
    res.json(t);
});

router.post('/templates', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const template = {
        id, name: req.body.name || 'Unnamed Style',
        description: req.body.description || '', rules: req.body.rules || {},
        example: req.body.example || '', tags: req.body.tags || [],
        isDefault: false, source: req.body.source || 'manual',
        sourceRef: req.body.sourceRef || '', createdAt: now, updatedAt: now
    };
    await store.setItem('style-templates', id, template);
    res.apiOk(template, null, 201);
});

router.put('/templates/:id', async (req, res) => {
    const existing = await store.getItem('style-templates', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Style template not found', NOT_FOUND.code);
    const updated = {
        ...existing, ...req.body,
        id: existing.id, isDefault: existing.isDefault,
        createdAt: existing.createdAt, updatedAt: new Date().toISOString()
    };
    await store.setItem('style-templates', existing.id, updated);
    res.json(updated);
});

router.delete('/templates/:id', async (req, res) => {
    const existing = await store.getItem('style-templates', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Style template not found', NOT_FOUND.code);
    if (existing.isDefault) return res.apiError(VALIDATION_ERROR.statusCode, 'Cannot delete default template', VALIDATION_ERROR.code);
    await store.deleteItem('style-templates', existing.id);
    res.json({ success: true });
});

router.post('/import-direct', async (req, res) => {
    const { text, name, description, tags } = req.body;
    if (!text || text.length < 50) return res.apiError(VALIDATION_ERROR.statusCode, 'Text must be at least 50 characters', VALIDATION_ERROR.code);
    if (!name || !name.trim()) return res.apiError(VALIDATION_ERROR.statusCode, 'Name is required for direct import', VALIDATION_ERROR.code);

    const id = uuidv4();
    const now = new Date().toISOString();
    const template = {
        id, name: name.trim(),
        description: description || `直接导入的风格文本（${text.length}字）`,
        rules: {}, example: text.substring(0, 10000),
        tags: tags || ['导入文本'], isDefault: false,
        source: 'direct', sourceRef: '直接导入',
        createdAt: now, updatedAt: now
    };
    await store.setItem('style-templates', id, template);
    res.apiOk(template, null, 201);
});

router.post('/apply-to-project', async (req, res) => {
    const { projectId, templateId } = req.body;
    if (!projectId || !templateId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and templateId required', VALIDATION_ERROR.code);

    const project = await store.getItem('projects', projectId);
    if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

    const template = await store.getItem('style-templates', templateId);
    if (!template) return res.apiError(NOT_FOUND.statusCode, 'Style template not found', NOT_FOUND.code);

    project.styleTemplateId = templateId;
    project.updatedAt = new Date().toISOString();
    await store.setItem('projects', project.id, project);

    res.json({ success: true, templateName: template.name });
});

module.exports = router;
