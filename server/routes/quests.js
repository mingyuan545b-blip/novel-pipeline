const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { ERROR_CODES } = require('../shared/errorCodes');
const { projectIdParam } = require('../middleware/validators');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const QUEST_STATUS = ['planned', 'active', 'completed', 'abandoned'];
const QUEST_PRIORITY = ['low', 'normal', 'high', 'critical'];

const router = require('express').Router();

router.post('/auto-init/:projectId', projectIdParam, async (req, res) => {
    try {
        const { autoInitProject } = require('./questAutoInit');
        const result = await autoInitProject(req.params.projectId);
        res.json(result);
    } catch (error) {
        const code = error.message === 'Project not found' ? NOT_FOUND : error.message === 'No chapters found' ? VALIDATION_ERROR : INTERNAL_ERROR;
        return res.apiError(code.statusCode, error.message, code.code);
    }
});

router.get('/quests', async (req, res) => {
    const { projectId, status, parentId } = req.query;
    let quests = await store.listItems('quests');
    if (projectId) quests = quests.filter(q => q.projectId === projectId);
    if (status) quests = quests.filter(q => q.status === status);
    if (parentId !== undefined) {
        if (parentId === 'root') quests = quests.filter(q => !q.parentId);
        else quests = quests.filter(q => q.parentId === parentId);
    }
    quests.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    res.json(quests);
});

router.get('/quests/:id', async (req, res) => {
    const quest = await store.getItem('quests', req.params.id);
    if (!quest) return res.apiError(NOT_FOUND.statusCode, 'Quest not found', NOT_FOUND.code);
    res.json(quest);
});

router.post('/quests', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const quest = {
        id, projectId: req.body.projectId || '', parentId: req.body.parentId || null,
        title: req.body.title || 'Unnamed Quest', description: req.body.description || '',
        status: QUEST_STATUS.includes(req.body.status) ? req.body.status : 'planned',
        priority: QUEST_PRIORITY.includes(req.body.priority) ? req.body.priority : 'normal',
        sortOrder: req.body.sortOrder ?? 0, materialIds: req.body.materialIds || [],
        chapterIds: req.body.chapterIds || [], timelineEventIds: req.body.timelineEventIds || [],
        progress: req.body.progress || 0, notes: req.body.notes || '',
        tags: req.body.tags || [], createdAt: now, updatedAt: now
    };
    await store.setItem('quests', id, quest);
    res.apiOk(quest, null, 201);
});

router.put('/quests/:id', async (req, res) => {
    const quest = await store.getItem('quests', req.params.id);
    if (!quest) return res.apiError(NOT_FOUND.statusCode, 'Quest not found', NOT_FOUND.code);
    const now = new Date().toISOString();
    const updated = { ...quest, ...req.body, id: quest.id, projectId: quest.projectId, createdAt: quest.createdAt, updatedAt: now };
    if (req.body.status === 'completed' && quest.status !== 'completed') { updated.completedAt = now; updated.progress = 100; }
    if (req.body.status === 'abandoned' && quest.status !== 'abandoned') { updated.abandonedAt = now; }
    await store.setItem('quests', quest.id, updated);
    res.json(updated);
});

router.delete('/quests/:id', async (req, res) => {
    const quest = await store.getItem('quests', req.params.id);
    if (!quest) return res.apiError(NOT_FOUND.statusCode, 'Quest not found', NOT_FOUND.code);
    const children = (await store.listItems('quests')).filter(q => q.parentId === quest.id);
    if (children.length > 0) return res.apiError(VALIDATION_ERROR.statusCode, 'Has sub-quests, delete or reassign them first', VALIDATION_ERROR.code, { childCount: children.length });
    await store.deleteItem('quests', quest.id);
    res.json({ success: true });
});

router.put('/quests/reorder', async (req, res) => {
    const { projectId, questIds } = req.body;
    if (!projectId || !Array.isArray(questIds)) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and questIds required', VALIDATION_ERROR.code);
    for (const [idx, qid] of questIds.entries()) {
        const quest = await store.getItem('quests', qid);
        if (quest) { quest.sortOrder = idx; quest.updatedAt = new Date().toISOString(); await store.setItem('quests', qid, quest); }
    }
    res.json({ success: true });
});

// 时间轴路由已移除，统一到知识库 /api/knowledge/timeline（SOP: 时间轴数据源统一）

router.get('/meta', (req, res) => {
    res.json({ questStatus: QUEST_STATUS, questPriority: QUEST_PRIORITY });
});

module.exports = router;
