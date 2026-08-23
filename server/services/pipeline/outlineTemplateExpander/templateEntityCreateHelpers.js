const store = require('../../../store');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../shared/logger');
const { resolveMaterialName } = require('../materialNameResolver');
const { saveTimelineEvent } = require('../../timelineAdapter');

async function createMaterialsFromTemplate(parsed, projectId, now) {
    const createdMaterials = [];
    if (!parsed.materials || !Array.isArray(parsed.materials)) return createdMaterials;

    for (const mat of parsed.materials) {
        const matId = uuidv4();
        const item = {
            id: matId, projectId, type: mat.type || 'other', name: resolveMaterialName(mat),
            description: '', initialContent: mat.content || '', currentContent: mat.content || '',
            tags: ['template-generated', ...(mat.type === 'character' && mat.isMainCharacter ? ['主角'] : [])],
            isLocked: mat.type === 'worldview', version: 1,
            changeLog: [{ from: '', to: mat.content || '', reason: 'Template auto-generated', timestamp: now }],
            createdAt: now, updatedAt: now
        };
        await store.setItem('materials', matId, item);
        createdMaterials.push(item);
    }
    return createdMaterials;
}

async function createQuestsFromTemplate(parsed, projectId, now) {
    const createdQuests = [];
    if (!parsed.mainQuests || !Array.isArray(parsed.mainQuests)) return createdQuests;

    for (let i = 0; i < parsed.mainQuests.length; i++) {
        const q = parsed.mainQuests[i];
        const questId = uuidv4();
        const quest = {
            id: questId, projectId, parentId: null, title: q.title || `主线任务${i + 1}`,
            description: q.description || '', status: 'planned',
            priority: ['low', 'normal', 'high', 'critical'].includes(q.priority) ? q.priority : 'normal',
            sortOrder: i, materialIds: [], chapterIds: [], timelineEventIds: [],
            progress: 0, notes: '', tags: ['template-generated', 'main-quest'],
            createdAt: now, updatedAt: now
        };
        await store.setItem('quests', questId, quest);
        createdQuests.push(quest);

        if (q.subQuests && Array.isArray(q.subQuests)) {
            for (let j = 0; j < q.subQuests.length; j++) {
                const sub = q.subQuests[j];
                const subId = uuidv4();
                await store.setItem('quests', subId, {
                    id: subId, projectId, parentId: questId, title: sub.title || `子任务${j + 1}`,
                    description: sub.description || '', status: 'planned', priority: 'normal',
                    sortOrder: j, materialIds: [], chapterIds: [], timelineEventIds: [],
                    progress: 0, notes: '', tags: ['template-generated', 'sub-quest'],
                    createdAt: now, updatedAt: now
                });
            }
        }
    }
    return createdQuests;
}

async function createTimelinesFromTemplate(parsed, projectId, now) {
    const createdTimelines = [];
    if (!parsed.timeline || !Array.isArray(parsed.timeline)) return createdTimelines;

    const VALID_EVENT_TYPES = ['plot', 'character', 'world', 'conflict', 'revelation', 'foreshadow', 'resolution'];
    const VALID_IMPORTANCES = ['low', 'normal', 'high', 'critical'];

    for (let i = 0; i < parsed.timeline.length; i++) {
        const ev = parsed.timeline[i];
        const evId = uuidv4();
        const event = {
            id: evId, projectId, title: ev.title || `事件${i + 1}`,
            description: ev.description || '',
            eventType: VALID_EVENT_TYPES.includes(ev.eventType) ? ev.eventType : 'plot',
            storyOrder: i, sortOrder: i, storyTime: ev.storyTime || '',
            chapterIds: [], questIds: [], materialIds: [], characterIds: [],
            location: ev.location || '',
            importance: VALID_IMPORTANCES.includes(ev.importance) ? ev.importance : 'normal',
            isKeyEvent: ev.isKeyEvent || false, notes: '', tags: ['template-generated'],
            createdAt: now, updatedAt: now
        };
        // 统一写入 timeline-events 表（SOP: 时间轴数据源统一，禁止写 timelines 表）
        await saveTimelineEvent(projectId, event);
        createdTimelines.push(event);
    }
    return createdTimelines;
}

async function createChaptersFromTemplate(parsed, projectId, now) {
    const createdChapters = [];
    if (!parsed.chapterOutlines || !Array.isArray(parsed.chapterOutlines)) return createdChapters;

    const allExistingTitles = (await store.queryItems('chapters', { projectId })).map(c => c.title).filter(Boolean);
    const allExistingOutlines = (await store.queryItems('chapters', { projectId })).map(c => (c.outline || '').substring(0, 80)).filter(Boolean);
    const usedTitles = new Set(allExistingTitles);
    const usedOutlineStarts = new Set(allExistingOutlines);

    for (const outline of parsed.chapterOutlines) {
        let title = outline.title || `${createdChapters.length + 1}章`;
        let dedupAttempts = 0;
        while (usedTitles.has(title) && dedupAttempts < 5) {
            dedupAttempts++;
            const suffix = dedupAttempts === 1 ? '（续）' : dedupAttempts === 2 ? '（下）' : dedupAttempts === 3 ? '（再续）' : `${dedupAttempts}）`;
            title = (outline.title || `${createdChapters.length + 1}章`) + suffix;
        }
        if (usedTitles.has(title)) {
            logger.info('outlineTemplateExpander', '[PIPELINE] Skipping unresolvable duplicate template chapter title: {outlineTitle}', { outlineTitle: outline.title });
            continue;
        }
        usedTitles.add(title);
        const outlineStart = (outline.outline || '').substring(0, 80);
        if (outlineStart && usedOutlineStarts.has(outlineStart)) {
            logger.info('outlineTemplateExpander', '[PIPELINE] Skipping duplicate template chapter outline: {outlineStart}', { outlineStart });
            continue;
        }
        if (outlineStart) usedOutlineStarts.add(outlineStart);

        const chId = uuidv4();
        const chapter = {
            id: chId, projectId, chapterNumber: outline.chapterNumber || createdChapters.length + 1,
            title, outline: outline.outline || '', content: '', status: 'outlined',
            wordCount: 0, round: 0, writerOutput: '', firstReviewOutput: '',
            secondReviewOutput: '', finalEditorOutput: '', history: [],
            createdAt: now, updatedAt: now
        };
        await store.setItem('chapters', chId, chapter);
        createdChapters.push(chapter);

        const qId2 = uuidv4();
        await store.setItem('quests', qId2, {
            id: qId2, projectId, parentId: null, title: `第${chapter.chapterNumber}章 ${chapter.title}`,
            description: chapter.outline || '', status: 'planned', priority: 'normal',
            sortOrder: chapter.chapterNumber - 1, materialIds: [], chapterIds: [chId],
            timelineEventIds: [], progress: 0, notes: '', tags: ['auto-generated'],
            createdAt: now, updatedAt: now
        });
    }
    return createdChapters;
}

module.exports = {
    createMaterialsFromTemplate,
    createQuestsFromTemplate,
    createTimelinesFromTemplate,
    createChaptersFromTemplate
};
