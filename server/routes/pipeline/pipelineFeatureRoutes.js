const router = require('express').Router();
const { getAllConstraints, getActiveConstraints, addConstraint, resolveConstraint } = require('../../services/consistencyConstraint');
const { getChronicleForProject, getChronicleForEntity } = require('../../services/characterChronicle');
const { FALLBACK_AGENT_TEMPLATES, getAgentTemplate } = require('../../services/prompts/promptBuilder');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

// ── 一致性约束API ──
router.get('/consistency-constraints/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, activeOnly } = req.query;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        if (activeOnly && chapterNumber) {
            const constraints = await getActiveConstraints(projectId, Number(chapterNumber));
            return res.json({ success: true, data: constraints, count: constraints.length });
        }
        const constraints = await getAllConstraints(projectId);
        res.json({ success: true, data: constraints, count: constraints.length });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/consistency-constraints/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { type, description, constraint, sourceChapter, evidence } = req.body;
        if (!projectId || !constraint || !sourceChapter) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, constraint, sourceChapter are required', VALIDATION_ERROR.code);
        }
        const result = await addConstraint(projectId, { type, description, constraint, sourceChapter: Number(sourceChapter), evidence });
        res.json({ success: true, data: result });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/consistency-constraints/:constraintId/resolve', async (req, res) => {
    try {
        const { constraintId } = req.params;
        const { resolvedBy } = req.body;
        const result = await resolveConstraint(constraintId, resolvedBy || 'manual');
        if (!result) return res.apiError(NOT_FOUND.statusCode, 'Constraint not found', NOT_FOUND.code);
        res.json({ success: true, data: result });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

// ── 角色编年史 API ──
router.get('/chronicle/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { entityId, fromChapter, toChapter } = req.query;
        const options = {};
        if (fromChapter) options.fromChapter = Number(fromChapter);
        if (toChapter) options.toChapter = Number(toChapter);
        if (entityId) options.entityId = entityId;
        const data = await getChronicleForProject(projectId, options);
        res.json({ success: true, data, count: data.length });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/chronicle/:projectId/:entityId', async (req, res) => {
    try {
        const { entityId } = req.params;
        const { fromChapter, toChapter } = req.query;
        const options = {};
        if (fromChapter) options.fromChapter = Number(fromChapter);
        if (toChapter) options.toChapter = Number(toChapter);
        const data = await getChronicleForEntity(entityId, options);
        res.json({ success: true, data, count: data.length });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/chronicle/:projectId/extract', async (req, res) => {
    try {
        const store = require('../../store');
        const chronicle = require('../../services/characterChronicle');
        const { projectId } = req.params;
        const { chapterNumbers, level } = req.body;
        const chronicleLevel = level || 'basic';
        const chapters = await store.queryItems('chapters', { projectId });
        const targetChapters = chapterNumbers
            ? chapters.filter(c => chapterNumbers.includes(c.chapterNumber))
            : chapters.filter(c => c.content && c.content.length > 100);
        const results = [];
        for (const ch of targetChapters) {
            try {
                const saved = await chronicle.extractAndSave(projectId, ch.chapterNumber, ch.content.substring(0, 8000), chronicleLevel);
                results.push({ chapterNumber: ch.chapterNumber, entries: saved.length });
            } catch (err) {
                results.push({ chapterNumber: ch.chapterNumber, error: err.message });
            }
        }
        res.json({ success: true, results, total: results.length });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

// ── Agents代理路由 ──
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

router.get('/agents', async (req, res) => {
    try {
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
        res.json(agents);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/agents/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const mode = req.query.mode || 'novel';
        const template = await getAgentTemplate(type, mode).catch(() => null);
        const fallback = FALLBACK_AGENT_TEMPLATES[type];
        if (!template && !fallback) {
            return res.apiError(NOT_FOUND.statusCode, `Agent type "${type}" not found`, NOT_FOUND.code);
        }
        const active = template || fallback;
        const meta = AGENT_META[type] || {};
        res.json({
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
            source: template ? 'database' : 'fallback',
            system: active.system || ''
        });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
