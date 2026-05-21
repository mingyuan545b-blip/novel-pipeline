const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const router = require('express').Router();

const QUEST_STATUS = ['planned', 'active', 'completed', 'abandoned'];
const QUEST_PRIORITY = ['low', 'normal', 'high', 'critical'];
const TIMELINE_EVENT_TYPE = ['plot', 'character', 'world', 'conflict', 'revelation', 'foreshadow', 'resolution'];

router.post('/auto-init/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const project = store.getItem('projects', projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const chapters = store.listItems('chapters').filter(c => c.projectId === projectId);
    const existingTimelines = store.listItems('timelines').filter(t => t.projectId === projectId);
    const existingQuests = store.listItems('quests').filter(q => q.projectId === projectId);

    if (chapters.length === 0) return res.status(400).json({ error: 'No chapters found' });

    const created = { timelines: 0, quests: 0, skipped: 0 };
    const now = new Date().toISOString();
    const protagonistName = project.styleProfile?.protagonistName || '主角';

    const mainQuestId = uuidv4();
    const mainQuest = {
        id: mainQuestId,
        projectId,
        parentId: null,
        title: `${protagonistName}的成长之路`,
        description: `${protagonistName}从平凡到超凡的主线成长轨迹，贯穿全书的终极目标`,
        status: 'active',
        priority: 'critical',
        sortOrder: 0,
        materialIds: [],
        chapterIds: [],
        timelineEventIds: [],
        progress: 0,
        notes: '系统自动生成的主线任务',
        tags: ['主线', '自动生成'],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('quests', mainQuestId, mainQuest);
    created.quests++;

    const sortedChapters = [...chapters].sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

    let phaseOrder = 0;
    const phaseMap = {};
    const PHASE_SIZE = 10;

    for (let i = 0; i < sortedChapters.length; i += PHASE_SIZE) {
        const phaseChapters = sortedChapters.slice(i, i + PHASE_SIZE);
        const startCh = phaseChapters[0].chapterNumber;
        const endCh = phaseChapters[phaseChapters.length - 1].chapterNumber;

        const phaseNames = ['起始篇·觉醒', '发展篇·磨砺', '转折篇·蜕变', '高潮篇·决战', '终局篇·归真', '余韵篇·新程'];
        const phaseIdx = Math.floor(i / PHASE_SIZE);
        const phaseName = phaseNames[phaseIdx] || `第${phaseIdx + 1}卷`;

        const phaseQuestId = uuidv4();
        const phaseQuest = {
            id: phaseQuestId,
            projectId,
            parentId: mainQuestId,
            title: phaseName,
            description: `第${startCh}-${endCh}章的故事弧线`,
            status: phaseIdx === 0 ? 'active' : 'planned',
            priority: 'high',
            sortOrder: phaseOrder,
            materialIds: [],
            chapterIds: phaseChapters.map(c => c.id),
            timelineEventIds: [],
            progress: 0,
            notes: '',
            tags: ['阶段任务', '自动生成'],
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('quests', phaseQuestId, phaseQuest);
        created.quests++;

        mainQuest.chapterIds = [...(mainQuest.chapterIds || []), ...phaseChapters.map(c => c.id)];
        mainQuest.timelineEventIds = [];

        phaseMap[phaseIdx] = { id: phaseQuestId, startCh, endCh, chapters: phaseChapters };
        phaseOrder++;
    }

    await store.setItem('quests', mainQuestId, mainQuest);

    const subPlanes = store.listItems('materials').filter(m => m.projectId === projectId && m.type === 'sub-plane' && !m.archived);
    for (const sp of subPlanes) {
        const spQuestId = uuidv4();
        const spQuest = {
            id: spQuestId,
            projectId,
            parentId: mainQuestId,
            title: `位面探索·${sp.name}`,
            description: `探索次位面"${sp.name}"，完成该位面的核心挑战`,
            status: 'planned',
            priority: 'normal',
            sortOrder: 100 + subPlanes.indexOf(sp),
            materialIds: [sp.id],
            chapterIds: [],
            timelineEventIds: [],
            progress: 0,
            notes: '',
            tags: ['位面探索', '自动生成'],
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('quests', spQuestId, spQuest);
        created.quests++;
    }

    let eventOrder = 0;
    for (const ch of sortedChapters) {
        const content = ch.content || ch.outline || ch.currentContent || '';
        const outline = ch.outline || ch.title || '';
        const text = content || outline;

        if (!text && !ch.title) { created.skipped++; continue; }

        const eventType = detectEventType(text || ch.title);
        const phaseIdx = Math.floor((sortedChapters.indexOf(ch)) / PHASE_SIZE);

        const event = {
            id: uuidv4(),
            projectId,
            title: ch.title || `第${ch.chapterNumber}章事件`,
            description: outline ? (outline.length > 200 ? outline.substring(0, 200) + '...' : outline) : '',
            eventType,
            storyOrder: eventOrder,
            sortOrder: eventOrder,
            storyTime: inferStoryTime(ch.chapterNumber, project),
            chapterIds: [ch.id],
            questIds: phaseMap[phaseIdx] ? [phaseMap[phaseIdx].id] : [],
            materialIds: [],
            characterIds: [],
            location: extractLocation(text),
            importance: ch.chapterNumber <= 3 ? 'high' : 'normal',
            isKeyEvent: isKeyEvent(text, ch.chapterNumber),
            notes: '',
            tags: [`第${ch.chapterNumber}章`, '自动生成'],
            createdAt: now,
            updatedAt: now
        };
        await store.setItem('timelines', event.id, event);
        created.timelines++;
        eventOrder++;

        if (phaseMap[phaseIdx]) {
            phaseMap[phaseIdx].timelineEventIds = [...(phaseMap[phaseIdx].timelineEventIds || []), event.id];
        }
    }

    for (const [idx, phase] of Object.entries(phaseMap)) {
        const pq = store.getItem('quests', phase.id);
        if (pq) {
            pq.timelineEventIds = phase.timelineEventIds || [];
            await store.setItem('quests', phase.id, pq);
        }
    }

    mainQuest.timelineEventIds = store.listItems('timelines').filter(t => t.projectId === projectId).map(t => t.id);
    await store.setItem('quests', mainQuestId, mainQuest);

    res.json({
        success: true,
        created,
        summary: {
            totalChapters: sortedChapters.length,
            totalTimelines: created.timelines,
            totalQuests: created.quests,
            mainQuest: mainQuest.title,
            phases: Object.values(phaseMap).map(p => ({ title: store.getItem('quests', p.id)?.title, chapters: `${p.startCh}-${p.endCh}` }))
        }
    });
});

function detectEventType(text) {
    const lower = (text || '').toLowerCase();
    if (/冲突|对抗|战斗|对决|厮杀|搏斗|交锋|围攻/.test(lower)) return 'conflict';
    if (/揭示|真相|揭秘|发现|揭露|识破|看穿/.test(lower)) return 'revelation';
    if (/伏笔|暗示|暗线|预兆|征兆|蛛丝马迹/.test(lower)) return 'foreshadow';
    if (/解决|胜利|突破|化解|平息|终结/.test(lower)) return 'resolution';
    if (/角色|人物|内心|成长|转变|觉醒|蜕变/.test(lower)) return 'character';
    if (/世界|设定|规则|体系|势力|格局/.test(lower)) return 'world';
    return 'plot';
}

function inferStoryTime(chapterNumber, project) {
    const genre = project?.styleProfile?.genre || '';
    if (genre.includes('高武') || genre.includes('玄幻') || genre.includes('修仙')) {
        return `灵元纪年·第${Math.ceil(chapterNumber / 5)}期`;
    }
    if (genre.includes('都市') || genre.includes('现代')) {
        return `第${Math.ceil(chapterNumber / 5)}周`;
    }
    return `第${Math.ceil(chapterNumber / 5)}阶段`;
}

function extractLocation(text) {
    const m = (text || '').match(/(?:在|于|来到|前往|抵达|身处|位于|进入)\s*([^\s,，。；;！!？?]{2,8})/);
    return m ? m[1] : '';
}

function isKeyEvent(text, chapterNumber) {
    if (chapterNumber <= 3) return true;
    if (/关键|转折|重大|决定性|分水岭|命运|生死/.test(text || '')) return true;
    return false;
}

router.get('/quests', (req, res) => {
    const { projectId, status, parentId } = req.query;
    let quests = store.listItems('quests');
    if (projectId) quests = quests.filter(q => q.projectId === projectId);
    if (status) quests = quests.filter(q => q.status === status);
    if (parentId !== undefined) {
        if (parentId === 'root') quests = quests.filter(q => !q.parentId);
        else quests = quests.filter(q => q.parentId === parentId);
    }
    quests.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    res.json(quests);
});

router.get('/quests/:id', (req, res) => {
    const quest = store.getItem('quests', req.params.id);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    res.json(quest);
});

router.post('/quests', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const quest = {
        id,
        projectId: req.body.projectId || '',
        parentId: req.body.parentId || null,
        title: req.body.title || 'Unnamed Quest',
        description: req.body.description || '',
        status: QUEST_STATUS.includes(req.body.status) ? req.body.status : 'planned',
        priority: QUEST_PRIORITY.includes(req.body.priority) ? req.body.priority : 'normal',
        sortOrder: req.body.sortOrder ?? 0,
        materialIds: req.body.materialIds || [],
        chapterIds: req.body.chapterIds || [],
        timelineEventIds: req.body.timelineEventIds || [],
        progress: req.body.progress || 0,
        notes: req.body.notes || '',
        tags: req.body.tags || [],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('quests', id, quest);
    res.status(201).json(quest);
});

router.put('/quests/:id', async (req, res) => {
    const quest = store.getItem('quests', req.params.id);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    const now = new Date().toISOString();
    const updated = {
        ...quest,
        ...req.body,
        id: quest.id,
        projectId: quest.projectId,
        createdAt: quest.createdAt,
        updatedAt: now
    };
    if (req.body.status === 'completed' && quest.status !== 'completed') {
        updated.completedAt = now;
        updated.progress = 100;
    }
    if (req.body.status === 'abandoned' && quest.status !== 'abandoned') {
        updated.abandonedAt = now;
    }
    await store.setItem('quests', quest.id, updated);
    res.json(updated);
});

router.delete('/quests/:id', (req, res) => {
    const quest = store.getItem('quests', req.params.id);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    const children = store.listItems('quests').filter(q => q.parentId === quest.id);
    if (children.length > 0) {
        return res.status(400).json({ error: 'Has sub-quests, delete or reassign them first', childCount: children.length });
    }
    store.deleteItem('quests', quest.id);
    res.json({ success: true });
});

router.put('/quests/reorder', async (req, res) => {
    const { projectId, questIds } = req.body;
    if (!projectId || !Array.isArray(questIds)) return res.status(400).json({ error: 'projectId and questIds required' });
    for (const [idx, qid] of questIds.entries()) {
        const quest = store.getItem('quests', qid);
        if (quest) {
            quest.sortOrder = idx;
            quest.updatedAt = new Date().toISOString();
            await store.setItem('quests', qid, quest);
        }
    }
    res.json({ success: true });
});

router.get('/timelines', (req, res) => {
    const { projectId, chapterId, eventType, questId } = req.query;
    let events = store.listItems('timelines');
    if (projectId) events = events.filter(e => e.projectId === projectId);
    if (chapterId) events = events.filter(e => (e.chapterIds || []).includes(chapterId));
    if (eventType) events = events.filter(e => e.eventType === eventType);
    if (questId) events = events.filter(e => (e.questIds || []).includes(questId));
    events.sort((a, b) => (a.storyOrder ?? a.sortOrder ?? 0) - (b.storyOrder ?? b.sortOrder ?? 0));
    res.json(events);
});

router.get('/timelines/:id', (req, res) => {
    const event = store.getItem('timelines', req.params.id);
    if (!event) return res.status(404).json({ error: 'Timeline event not found' });
    res.json(event);
});

router.post('/timelines', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const event = {
        id,
        projectId: req.body.projectId || '',
        title: req.body.title || 'Unnamed Event',
        description: req.body.description || '',
        eventType: TIMELINE_EVENT_TYPE.includes(req.body.eventType) ? req.body.eventType : 'plot',
        storyOrder: req.body.storyOrder ?? 0,
        sortOrder: req.body.sortOrder ?? 0,
        storyTime: req.body.storyTime || '',
        chapterIds: req.body.chapterIds || [],
        questIds: req.body.questIds || [],
        materialIds: req.body.materialIds || [],
        characterIds: req.body.characterIds || [],
        location: req.body.location || '',
        importance: req.body.importance || 'normal',
        isKeyEvent: req.body.isKeyEvent || false,
        notes: req.body.notes || '',
        tags: req.body.tags || [],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('timelines', id, event);
    res.status(201).json(event);
});

router.put('/timelines/:id', async (req, res) => {
    const event = store.getItem('timelines', req.params.id);
    if (!event) return res.status(404).json({ error: 'Timeline event not found' });
    const now = new Date().toISOString();
    const updated = {
        ...event,
        ...req.body,
        id: event.id,
        projectId: event.projectId,
        createdAt: event.createdAt,
        updatedAt: now
    };
    await store.setItem('timelines', event.id, updated);
    res.json(updated);
});

router.delete('/timelines/:id', (req, res) => {
    const event = store.getItem('timelines', req.params.id);
    if (!event) return res.status(404).json({ error: 'Timeline event not found' });
    store.deleteItem('timelines', event.id);
    res.json({ success: true });
});

router.put('/timelines/reorder', async (req, res) => {
    const { projectId, eventIds } = req.body;
    if (!projectId || !Array.isArray(eventIds)) return res.status(400).json({ error: 'projectId and eventIds required' });
    for (const [idx, eid] of eventIds.entries()) {
        const event = store.getItem('timelines', eid);
        if (event) {
            event.sortOrder = idx;
            event.storyOrder = idx;
            event.updatedAt = new Date().toISOString();
            await store.setItem('timelines', eid, event);
        }
    }
    res.json({ success: true });
});

router.get('/meta', (req, res) => {
    res.json({
        questStatus: QUEST_STATUS,
        questPriority: QUEST_PRIORITY,
        timelineEventTypes: TIMELINE_EVENT_TYPE
    });
});

module.exports = router;
