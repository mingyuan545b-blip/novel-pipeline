const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const router = require('express').Router();
const { FALLBACK_AGENT_TEMPLATES } = require('../services/prompts/promptBuilder');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

router.get('/agent-templates', async (req, res) => {
    const templates = await store.listItems('agent-templates');
    const { agentType, mode } = req.query;
    let filtered = templates;
    if (agentType) filtered = filtered.filter(t => t.agentType === agentType);
    if (mode) filtered = filtered.filter(t => t.mode === mode);

    if (filtered.length === 0) {
        filtered = Object.entries(FALLBACK_AGENT_TEMPLATES).map(([type, fb]) => ({
            id: `fallback-${type}`,
            agentType: type,
            mode: fb.mode || 'novel',
            role: fb.role || 'user',
            tool: fb.tool || '',
            system: fb.system || '',
            source: 'fallback',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
        if (agentType) filtered = filtered.filter(t => t.agentType === agentType);
        if (mode) filtered = filtered.filter(t => t.mode === mode || t.mode === 'novel');
    }

    res.json(filtered);
});

router.get('/agent-templates/:id', async (req, res) => {
    const tpl = await store.getItem('agent-templates', req.params.id);
    if (!tpl) return res.apiError(NOT_FOUND.statusCode, 'Template not found', NOT_FOUND.code);
    res.json(tpl);
});

router.post('/agent-templates', async (req, res) => {
    const id = req.body.id || `tpl_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const tpl = {
        id, agentType: req.body.agentType || 'writer', mode: req.body.mode || 'novel',
        role: req.body.role || '', tool: req.body.tool || '', system: req.body.system || '',
        createdAt: req.body.createdAt || now, updatedAt: now
    };
    await store.setItem('agent-templates', id, tpl);
    res.apiOk(tpl, null, 201);
});

router.put('/agent-templates/:id', async (req, res) => {
    const existing = await store.getItem('agent-templates', req.params.id);
    if (!existing) return res.apiError(NOT_FOUND.statusCode, 'Template not found', NOT_FOUND.code);
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    await store.setItem('agent-templates', existing.id, updated);
    res.json(updated);
});

router.delete('/agent-templates/:id', async (req, res) => {
    const deleted = await store.deleteItem('agent-templates', req.params.id);
    if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Template not found', NOT_FOUND.code);
    res.json({ success: true });
});

module.exports = router;
