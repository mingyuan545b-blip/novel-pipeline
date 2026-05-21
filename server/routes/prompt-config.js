const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const router = require('express').Router();

router.get('/agent-templates', (req, res) => {
    const templates = store.listItems('agent-templates');
    const { agentType, mode } = req.query;
    let filtered = templates;
    if (agentType) filtered = filtered.filter(t => t.agentType === agentType);
    if (mode) filtered = filtered.filter(t => t.mode === mode);
    res.json(filtered);
});

router.get('/agent-templates/:id', (req, res) => {
    const tpl = store.getItem('agent-templates', req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tpl);
});

router.post('/agent-templates', async (req, res) => {
    const id = req.body.id || `tpl_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const tpl = {
        id,
        agentType: req.body.agentType || 'writer',
        mode: req.body.mode || 'novel',
        role: req.body.role || '',
        tool: req.body.tool || '',
        system: req.body.system || '',
        createdAt: req.body.createdAt || now,
        updatedAt: now
    };
    await store.setItem('agent-templates', id, tpl);
    res.status(201).json(tpl);
});

router.put('/agent-templates/:id', async (req, res) => {
    const existing = store.getItem('agent-templates', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    const updated = {
        ...existing,
        ...req.body,
        id: existing.id,
        updatedAt: new Date().toISOString()
    };
    await store.setItem('agent-templates', existing.id, updated);
    res.json(updated);
});

router.delete('/agent-templates/:id', (req, res) => {
    const deleted = store.deleteItem('agent-templates', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
});

router.get('/style-profiles', (req, res) => {
    const profiles = store.listItems('style-profiles');
    res.json(profiles);
});

router.get('/style-profiles/:id', (req, res) => {
    const profile = store.getItem('style-profiles', req.params.id);
    if (!profile) return res.status(404).json({ error: 'Style profile not found' });
    res.json(profile);
});

router.get('/style-profiles/key/:key', (req, res) => {
    const profiles = store.listItems('style-profiles');
    const found = profiles.find(p => p.key === req.params.key);
    if (!found) return res.status(404).json({ error: 'Style profile not found' });
    res.json(found);
});

router.post('/style-profiles', async (req, res) => {
    const id = req.body.id || `profile_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const profile = {
        id,
        key: req.body.key || '',
        label: req.body.label || '',
        description: req.body.description || '',
        materialFocus: req.body.materialFocus || {},
        povRule: req.body.povRule || '',
        dialogueRule: req.body.dialogueRule || '',
        behaviorRule: req.body.behaviorRule || '',
        toneRule: req.body.toneRule || '',
        reviewFocus: req.body.reviewFocus || '',
        constraintOverrides: req.body.constraintOverrides || [],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('style-profiles', id, profile);
    res.status(201).json(profile);
});

router.put('/style-profiles/:id', async (req, res) => {
    const existing = store.getItem('style-profiles', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Style profile not found' });
    const updated = {
        ...existing,
        ...req.body,
        id: existing.id,
        key: existing.key,
        updatedAt: new Date().toISOString()
    };
    await store.setItem('style-profiles', existing.id, updated);
    res.json(updated);
});

router.delete('/style-profiles/:id', (req, res) => {
    const deleted = store.deleteItem('style-profiles', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Style profile not found' });
    res.json({ success: true });
});

router.get('/constraint-presets', (req, res) => {
    const presets = store.listItems('constraint-presets');
    res.json(presets);
});

router.get('/constraint-presets/:id', (req, res) => {
    const preset = store.getItem('constraint-presets', req.params.id);
    if (!preset) return res.status(404).json({ error: 'Constraint preset not found' });
    res.json(preset);
});

router.post('/constraint-presets', async (req, res) => {
    const { id, label, desc } = req.body;
    if (!id || !label) return res.status(400).json({ error: 'id and label are required' });
    const now = new Date().toISOString();
    await store.setItem('constraint-presets', id, { id, label, desc: desc || '', createdAt: now, updatedAt: now });
    res.status(201).json({ id, label, desc });
});

router.put('/constraint-presets/:id', async (req, res) => {
    const existing = store.getItem('constraint-presets', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Constraint preset not found' });
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    await store.setItem('constraint-presets', existing.id, updated);
    res.json(updated);
});

router.delete('/constraint-presets/:id', (req, res) => {
    const deleted = store.deleteItem('constraint-presets', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Constraint preset not found' });
    res.json({ success: true });
});

router.get('/foundation-prompts', (req, res) => {
    const foundations = store.listItems('foundation-prompts');
    res.json(foundations);
});

router.get('/foundation-prompts/:id', (req, res) => {
    const fp = store.getItem('foundation-prompts', req.params.id);
    if (!fp) return res.status(404).json({ error: 'Foundation prompt not found' });
    res.json(fp);
});

router.post('/foundation-prompts', async (req, res) => {
    const id = req.body.id || `foundation_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const fp = {
        id,
        version: req.body.version || '1.0',
        content: req.body.content || '',
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('foundation-prompts', id, fp);
    res.status(201).json(fp);
});

router.put('/foundation-prompts/:id', async (req, res) => {
    const existing = store.getItem('foundation-prompts', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Foundation prompt not found' });
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    await store.setItem('foundation-prompts', existing.id, updated);
    res.json(updated);
});

router.delete('/foundation-prompts/:id', (req, res) => {
    const deleted = store.deleteItem('foundation-prompts', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Foundation prompt not found' });
    res.json({ success: true });
});

router.get('/resolved-prompt', (req, res) => {
    const { agentType, mode, projectId } = req.query;
    if (!agentType) return res.status(400).json({ error: 'agentType is required' });

    const { getAgentPrompt, buildFoundationPrompt, buildStyleInjection, buildConstraintInjection } = require('../services/agentPrompts');

    const agent = getAgentPrompt(agentType, mode || 'novel', projectId || null);
    if (!agent) return res.status(404).json({ error: 'Agent template not found' });

    const foundation = projectId ? buildFoundationPrompt(agentType, mode || 'novel') : '';
    const style = projectId ? buildStyleInjection(projectId) : '';
    const constraints = projectId ? buildConstraintInjection(projectId) : '';

    res.json({
        agentType,
        mode: mode || 'novel',
        projectId: projectId || null,
        role: agent.role,
        tool: agent.tool,
        system: agent.system,
        foundation,
        styleInjection: style,
        constraintInjection: constraints,
        totalLength: (agent.system || '').length + foundation.length + style.length + constraints.length
    });
});

module.exports = router;
