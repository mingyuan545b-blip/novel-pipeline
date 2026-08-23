const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const router = require('express').Router();
const { BASE_CONSTRAINT_PRESETS } = require('../services/prompts/constraintInjector');
const { getGenreRegistry } = require('../services/genreConfig');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

// --- Style Profiles ---
router.get('/style-profiles', async (req, res) => {
    const profiles = await store.listItems('style-profiles');
    if (profiles.length === 0) {
        const genres = getGenreRegistry();
        const builtIn = genres.map(g => ({
            id: `genre-${g.id}`, key: g.id, label: g.label || g.id,
            description: g.description || '', source: 'genre',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        }));
        return res.json(builtIn);
    }
    res.json(profiles);
});

router.get('/style-profiles/:id', async (req, res) => {
    const profile = await store.getItem('style-profiles', req.params.id);
    if (!profile) return res.apiError(NOT_FOUND.statusCode, 'Style profile not found', NOT_FOUND.code);
    res.json(profile);
});

router.get('/style-profiles/key/:key', async (req, res) => {
    const profiles = await store.listItems('style-profiles');
    const found = profiles.find(p => p.key === req.params.key);
    if (!found) return res.apiError(NOT_FOUND.statusCode, 'Style profile not found', NOT_FOUND.code);
    res.json(found);
});

router.post('/style-profiles', async (req, res) => {
    const id = req.body.id || `profile_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const profile = {
        id, key: req.body.key || '', label: req.body.label || '',
        description: req.body.description || '', materialFocus: req.body.materialFocus || {},
        povRule: req.body.povRule || '', dialogueRule: req.body.dialogueRule || '',
        behaviorRule: req.body.behaviorRule || '', toneRule: req.body.toneRule || '',
        reviewFocus: req.body.reviewFocus || '', constraintOverrides: req.body.constraintOverrides || [],
        createdAt: now, updatedAt: now
    };
    await store.setItem('style-profiles', id, profile);
    res.apiOk(profile, null, 201);
});

router.put('/style-profiles/:id', async (req, res) => {
    const existing = await store.getItem('style-profiles', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Style profile not found', NOT_FOUND.code);
    const updated = { ...existing, ...req.body, id: existing.id, key: existing.key, updatedAt: new Date().toISOString() };
    await store.setItem('style-profiles', existing.id, updated);
    res.json(updated);
});

router.delete('/style-profiles/:id', async (req, res) => {
    const deleted = await store.deleteItem('style-profiles', req.params.id);
    if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Style profile not found', NOT_FOUND.code);
    res.json({ success: true });
});

// --- Constraint Presets ---
router.get('/constraint-presets', async (req, res) => {
    const presets = await store.listItems('constraint-presets');
    if (presets.length === 0) {
        const builtIn = Object.entries(BASE_CONSTRAINT_PRESETS).map(([id, p]) => ({
            id, label: p.label, desc: p.desc, source: 'fallback',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        }));
        return res.json(builtIn);
    }
    res.json(presets);
});

router.get('/constraint-presets/:id', async (req, res) => {
    const preset = await store.getItem('constraint-presets', req.params.id);
    if (!preset) return res.apiError(NOT_FOUND.statusCode, 'Constraint preset not found', NOT_FOUND.code);
    res.json(preset);
});

router.post('/constraint-presets', async (req, res) => {
    const { id, label, desc } = req.body;
    if (!id || !label) return res.apiError(VALIDATION_ERROR.statusCode, 'id and label are required', VALIDATION_ERROR.code);
    const now = new Date().toISOString();
    await store.setItem('constraint-presets', id, { id, label, desc: desc || '', createdAt: now, updatedAt: now });
    res.apiOk({ id, label, desc }, null, 201);
});

router.put('/constraint-presets/:id', async (req, res) => {
    const existing = await store.getItem('constraint-presets', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Constraint preset not found', NOT_FOUND.code);
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    await store.setItem('constraint-presets', existing.id, updated);
    res.json(updated);
});

router.delete('/constraint-presets/:id', async (req, res) => {
    const deleted = await store.deleteItem('constraint-presets', req.params.id);
    if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Constraint preset not found', NOT_FOUND.code);
    res.json({ success: true });
});

// --- Foundation Prompts ---
router.get('/foundation-prompts', async (req, res) => {
    const foundations = await store.listItems('foundation-prompts');
    res.json(foundations);
});

router.get('/foundation-prompts/:id', async (req, res) => {
    const fp = await store.getItem('foundation-prompts', req.params.id);
    if (!fp) return res.apiError(NOT_FOUND.statusCode, 'Foundation prompt not found', NOT_FOUND.code);
    res.json(fp);
});

router.post('/foundation-prompts', async (req, res) => {
    const id = req.body.id || `foundation_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const fp = { id, version: req.body.version || '1.0', content: req.body.content || '', createdAt: now, updatedAt: now };
    await store.setItem('foundation-prompts', id, fp);
    res.apiOk(fp, null, 201);
});

router.put('/foundation-prompts/:id', async (req, res) => {
    const existing = await store.getItem('foundation-prompts', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Foundation prompt not found', NOT_FOUND.code);
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    await store.setItem('foundation-prompts', existing.id, updated);
    res.json(updated);
});

router.delete('/foundation-prompts/:id', async (req, res) => {
    const deleted = await store.deleteItem('foundation-prompts', req.params.id);
    if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Foundation prompt not found', NOT_FOUND.code);
    res.json({ success: true });
});

// --- Resolved Prompt ---
router.get('/resolved-prompt', async (req, res) => {
    const { agentType, mode, projectId } = req.query;
    if (!agentType) return res.apiError(VALIDATION_ERROR.statusCode, 'agentType is required', VALIDATION_ERROR.code);

    const { assembleAgentPrompt } = require('../services/prompts/agentPromptAssembler');

    if (!projectId) {
        const { getAgentTemplate } = require('../services/prompts/promptBuilder');
        const template = await getAgentTemplate(agentType, mode || 'novel');
        if (!template) return res.apiError(NOT_FOUND.statusCode, 'Agent template not found', NOT_FOUND.code);
        return res.json({
            agentType, mode: mode || 'novel', projectId: null,
            role: template.role, tool: template.tool, system: template.system,
            buildLog: [], totalLength: template.system.length
        });
    }

    const assembled = await assembleAgentPrompt(agentType, mode || 'novel', projectId);
    if (!assembled) return res.apiError(NOT_FOUND.statusCode, 'Agent template not found', NOT_FOUND.code);

    res.json({
        agentType, mode: mode || 'novel', projectId,
        role: assembled.role, tool: assembled.tool, system: assembled.system,
        buildLog: assembled.buildLog, totalLength: assembled.system.length
    });
});

module.exports = router;
