const fs = require('fs');
const path = require('path');
const router = require('express').Router();

const AGENTS_DIR = path.join(__dirname, '..', '..', 'mcp-agents');

router.get('/', (req, res) => {
    const agents = [];
    if (fs.existsSync(AGENTS_DIR)) {
        const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        for (const dir of dirs) {
            const manifestPath = path.join(AGENTS_DIR, dir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                agents.push({ directory: dir, ...manifest });
            } else {
                agents.push({ directory: dir, name: dir, status: 'no-manifest' });
            }
        }
    }
    res.json(agents);
});

router.get('/:type', (req, res) => {
    const agentDir = path.join(AGENTS_DIR, req.params.type);
    if (!fs.existsSync(agentDir)) return res.status(404).json({ error: 'Agent not found' });

    const result = { directory: req.params.type };
    const manifestPath = path.join(agentDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        result.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }
    const serverPath = path.join(agentDir, 'server.js');
    if (fs.existsSync(serverPath)) {
        result.serverCode = fs.readFileSync(serverPath, 'utf-8');
    }
    res.json(result);
});

router.put('/:type/manifest', (req, res) => {
    const agentDir = path.join(AGENTS_DIR, req.params.type);
    if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
    const manifestPath = path.join(agentDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true });
});

router.put('/:type/server', (req, res) => {
    const agentDir = path.join(AGENTS_DIR, req.params.type);
    if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
    const serverPath = path.join(agentDir, 'server.js');
    fs.writeFileSync(serverPath, req.body.code, 'utf-8');
    res.json({ success: true });
});

router.put('/:type/prompt', async (req, res) => {
    const { systemPrompt, projectId } = req.body;
    if (!systemPrompt) return res.status(400).json({ error: 'systemPrompt is required' });
    const store = require('../store');
    const agentType = req.params.type;

    if (projectId) {
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        const overrides = project.agentOverrides || {};
        overrides[agentType] = systemPrompt;
        await store.setItem('projects', projectId, { ...project, agentOverrides: overrides });
        return res.json({ success: true, scope: 'project' });
    }

    const templates = store.listItems('agent-templates');
    const existing = templates.find(t => t.agentType === agentType);
    if (existing) {
        await store.setItem('agent-templates', existing.id, { ...existing, system: systemPrompt });
        return res.json({ success: true, scope: 'global' });
    }
    return res.status(404).json({ error: 'Agent template not found. Create it via agent-templates first.' });
});

router.get('/prompt-preview/:projectId/:agentType', (req, res) => {
    const { projectId, agentType } = req.params;
    const mode = req.query.mode || 'novel';
    const store = require('../store');
    const project = store.getItem('projects', projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { getAgentPrompt } = require('../services/_agentPromptsLegacy');
    const agent = getAgentPrompt(agentType, mode, projectId);
    if (!agent) return res.status(404).json({ error: `Agent type "${agentType}" not found` });
    res.json({
        agentType,
        mode,
        projectId,
        roleName: agent.role,
        systemLength: agent.system.length,
        buildLog: agent._buildLog || [],
        systemPreview: agent.system.substring(0, 2000) + (agent.system.length > 2000 ? '\n\n... (truncated, total ' + agent.system.length + ' chars)' : '')
    });
});

module.exports = router;
