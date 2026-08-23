const fs = require('fs');
const path = require('path');
const router = require('express').Router();

const AGENTS_DIR = path.join(__dirname, '..', '..', 'mcp-agents');
const { FALLBACK_AGENT_TEMPLATES, getAgentTemplate, buildFoundationPrompt } = require('../services/prompts/promptBuilder');
const { getGenreById, detectGenre, GENRE_REGISTRY } = require('../services/genreConfig');
const { ERROR_CODES } = require('../shared/errorCodes');
const { projectIdParam } = require('../middleware/validators');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

const AGENT_META = {
    writer: { name: '执笔人', icon: '✍', color: 'var(--neon-blue)', category: '创作' },
    'intent-planner': { name: '意图规划', icon: '📋', color: '#2ed573', category: '规划' },
    'first-review': { name: '初审', icon: '✓', color: 'var(--neon-green)', category: '审核' },
    'second-review': { name: '复审', icon: '★', color: 'var(--neon-orange)', category: '审核' },
    'fast-review': { name: '快审', icon: '⚡', color: '#ffa502', category: '审核' },
    'final-editor': { name: '定稿人', icon: '♛', color: 'var(--neon-pink)', category: '编辑' },
    'material-manager': { name: '素材管理', icon: '⬡', color: 'var(--neon-purple)', category: '管理' },
    reader: { name: '阅读者', icon: '📖', color: '#e17055', category: '审核' },
    polisher: { name: '润色师', icon: '✦', color: '#a29bfe', category: '编辑' },
    reviser: { name: '返修员', icon: '🔧', color: '#00d2d3', category: '编辑' }
};

router.get('/', async (req, res) => {
    const mode = req.query.mode || 'novel';
    const agents = [];

    for (const [type, fallback] of Object.entries(FALLBACK_AGENT_TEMPLATES)) {
        const template = await getAgentTemplate(type, mode).catch(() => null);
        const active = template || fallback;
        const meta = AGENT_META[type] || {};
        agents.push({
            type,
            name: meta.name || active.agentType,
            icon: meta.icon || '🤖',
            color: meta.color || 'var(--neon-cyan)',
            category: meta.category || '其他',
            mode: active.mode || mode,
            role: active.role || 'user',
            tool: active.tool || '',
            hasCustomTemplate: !!template,
            systemLength: (active.system || '').length,
            source: template ? 'database' : 'fallback'
        });
    }

    if (fs.existsSync(AGENTS_DIR)) {
        const dirs = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        for (const dir of dirs) {
            if (agents.find(a => a.type === dir)) continue;
            const manifestPath = path.join(AGENTS_DIR, dir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                agents.push({ type: dir, directory: dir, source: 'mcp-agents', ...manifest });
            } else {
                agents.push({ type: dir, directory: dir, name: dir, source: 'mcp-agents', status: 'no-manifest' });
            }
        }
    }

    res.json(agents);
});

router.get('/:type', async (req, res) => {
    const agentType = req.params.type;
    const mode = req.query.mode || 'novel';
    const meta = AGENT_META[agentType] || {};

    const template = await getAgentTemplate(agentType, mode).catch(() => null);
    const fallback = FALLBACK_AGENT_TEMPLATES[agentType];
    const active = template || fallback;

    if (!active) {
        const agentDir = path.join(AGENTS_DIR, agentType);
        if (fs.existsSync(agentDir)) {
            const manifestPath = path.join(agentDir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                return res.json({ type: agentType, source: 'mcp-agents', ...manifest });
            }
        }
        return res.apiError(NOT_FOUND.statusCode, `Agent type "${agentType}" not found`, NOT_FOUND.code);
    }

    res.json({
        type: agentType,
        name: meta.name || active.agentType,
        icon: meta.icon || '🤖',
        color: meta.color || 'var(--neon-cyan)',
        category: meta.category || '其他',
        mode: active.mode || mode,
        role: active.role || 'user',
        tool: active.tool || '',
        systemPrompt: active.system || '',
        hasCustomTemplate: !!template,
        systemLength: (active.system || '').length,
        source: template ? 'database' : 'fallback'
    });
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
    if (!systemPrompt) return res.apiError(VALIDATION_ERROR.statusCode, 'systemPrompt is required', VALIDATION_ERROR.code);
    const store = require('../store');
    const agentType = req.params.type;

    if (projectId) {
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const overrides = project.agentOverrides || {};
        overrides[agentType] = systemPrompt;
        await store.setItem('projects', projectId, { ...project, agentOverrides: overrides });
        return res.json({ success: true, scope: 'project' });
    }

    const templates = await store.listItems('agent-templates');
    const existing = templates.find(t => t.agentType === agentType);
    if (existing) {
        await store.setItem('agent-templates', existing.id, { ...existing, system: systemPrompt });
        return res.json({ success: true, scope: 'global' });
    }

    const fallback = FALLBACK_AGENT_TEMPLATES[agentType];
    const id = `at-${agentType}-${Date.now()}`;
    const newTemplate = {
        id,
        agentType,
        mode: fallback?.mode || 'novel',
        role: fallback?.role || 'user',
        system: systemPrompt,
        tool: fallback?.tool || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await store.setItem('agent-templates', id, newTemplate);
    return res.json({ success: true, scope: 'global', created: true });
});

router.get('/prompt-preview/:projectId/:agentType', projectIdParam, async (req, res) => {
    const { projectId, agentType } = req.params;
    const mode = req.query.mode || 'novel';
    const store = require('../store');
    const project = await store.getItem('projects', projectId);
    if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
    const { getAgentPrompt } = require('../services/agentPrompts');
    const agent = await getAgentPrompt(agentType, mode, projectId);
    if (!agent) return res.apiError(NOT_FOUND.statusCode, `Agent type "${agentType}" not found`, NOT_FOUND.code);
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
module.exports.AGENT_META = AGENT_META;
