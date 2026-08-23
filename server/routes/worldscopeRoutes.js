/**
 * worldscopeRoutes — 世界域归属API路由
 *
 * 标准 module.exports = router 方式（已从 app.get 直接注册方式统一）
 */
const router = require('express').Router();
const worldScopeModule = require('../services/worldScopeModule');
const { buildWorldScopeView } = require('../services/worldScopeViewBuilder');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/worldscope/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const data = await worldScopeModule.getWorldScopes(projectId);
        const worlds = await worldScopeModule.getProjectWorlds(projectId);
        // 组装前端期望的 worldEntities 和 events 结构（字段映射在后端完成）
        const { worldEntities, events } = buildWorldScopeView(data);
        // 拉取所有世界的势力并按 worldId 分组(势力绑定世界)
        const allFactions = await worldScopeModule.getWorldFactions(projectId);
        const factionsByWorld = {};
        for (const f of allFactions) {
            const wid = f.worldId || 'main-world';
            if (!factionsByWorld[wid]) factionsByWorld[wid] = [];
            factionsByWorld[wid].push(f);
        }
        res.json({
            success: true, data, worlds, worldEntities, events, factionsByWorld,
            count: Array.isArray(data) ? data.length : 0
        });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/worldscope/:projectId/entity/:entityId', async (req, res) => {
    try {
        const allScopes = await worldScopeModule.getWorldScopes(req.params.projectId);
        const data = allScopes.filter(s => s.entityId === req.params.entityId);
        res.json({ success: true, data, count: data.length });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/worldscope/:projectId/worlds', async (req, res) => {
    try {
        const project = await worldScopeModule.saveProjectWorlds(req.params.projectId, req.body.worlds);
        res.json({ success: true, data: project?.settings?.worlds });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/worldscope/:projectId/extract', async (req, res) => {
    try {
        const store = require('../store');
        const { projectId } = req.params;
        const { chapterNumbers, level } = req.body;
        const scopeLevel = level || 'basic';
        const chapters = await store.queryItems('chapters', { projectId });
        const targetChapters = chapterNumbers
            ? chapters.filter(c => chapterNumbers.includes(c.chapterNumber))
            : chapters.filter(c => c.content && c.content.length > 100);
        const results = [];
        for (const ch of targetChapters) {
            try {
                const saved = await worldScopeModule.extractAndSave(projectId, ch.chapterNumber, ch.content.substring(0, 8000), scopeLevel);
                results.push({
                    chapterNumber: ch.chapterNumber,
                    entities: saved.entities.length,
                    transitions: saved.transitions.length,
                    crossWorldItems: (saved.crossWorldItems || []).length
                });
            } catch (err) { results.push({ chapterNumber: ch.chapterNumber, error: err.message }); }
        }
        res.json({ success: true, results, total: results.length });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

// ── 跨世界物品溯源 API ──
const crossWorldTrace = require('../services/crossWorldTraceModule');

/** 查询项目所有跨世界溯源记录（支持过滤：characterId/entityId/originWorldId/entityType） */
router.get('/worldscope/:projectId/traces', async (req, res) => {
    try {
        const { projectId } = req.params;
        const filters = {};
        const { characterId, entityId, originWorldId, currentWorldId, entityType } = req.query;
        if (characterId) filters.characterId = characterId;
        if (entityId) filters.entityId = entityId;
        if (originWorldId) filters.originWorldId = originWorldId;
        if (currentWorldId) filters.currentWorldId = currentWorldId;
        if (entityType) filters.entityType = entityType;
        const traces = await crossWorldTrace.getTracesByProject(projectId, filters);
        res.json({ success: true, data: traces, count: traces.length });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

/** 查询单条溯源记录 */
router.get('/worldscope/:projectId/traces/:traceId', async (req, res) => {
    try {
        const trace = await crossWorldTrace.getTrace(req.params.projectId, req.params.traceId);
        if (!trace) return res.apiError(NOT_FOUND.statusCode, '溯源记录不存在', NOT_FOUND.code);
        res.json({ success: true, data: trace });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

/** 创建溯源记录 */
router.post('/worldscope/:projectId/traces', async (req, res) => {
    try {
        const trace = await crossWorldTrace.createTrace(req.params.projectId, req.body);
        res.json({ success: true, data: trace });
    } catch (error) { return res.apiError(VALIDATION_ERROR.statusCode, error.message, VALIDATION_ERROR.code); }
});

/** 追加跨世界事件 */
router.post('/worldscope/:projectId/traces/:traceId/events', async (req, res) => {
    try {
        const trace = await crossWorldTrace.addTraceEvent(req.params.projectId, req.params.traceId, req.body);
        res.json({ success: true, data: trace });
    } catch (error) { return res.apiError(VALIDATION_ERROR.statusCode, error.message, VALIDATION_ERROR.code); }
});

/** 更新溯源记录 */
router.put('/worldscope/:projectId/traces/:traceId', async (req, res) => {
    try {
        const trace = await crossWorldTrace.updateTrace(req.params.projectId, req.params.traceId, req.body);
        res.json({ success: true, data: trace });
    } catch (error) { return res.apiError(VALIDATION_ERROR.statusCode, error.message, VALIDATION_ERROR.code); }
});

/** 删除溯源记录 */
router.delete('/worldscope/:projectId/traces/:traceId', async (req, res) => {
    try {
        await crossWorldTrace.deleteTrace(req.params.projectId, req.params.traceId);
        res.json({ success: true });
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

module.exports = router;
