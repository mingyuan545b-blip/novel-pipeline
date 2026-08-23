/**
 * questHelpers - 任务/时间线创建辅助函数
 */
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const PHASE_SIZE = 10;
const PHASE_NAMES = ['起始篇·觉醒', '发展篇·磨砺', '转折篇·蜕变', '高潮篇·决战', '终局篇·归真', '余韵篇·新程'];

async function ensureMainQuest(projectId, protagonistName, existingQuests) {
    const existing = existingQuests.find(q => !q.parentId);
    if (existing) return { quest: existing, created: false };
    const now = new Date().toISOString();
    const id = uuidv4();
    const quest = {
        id, projectId, parentId: null,
        title: `${protagonistName}的成长之路`,
        description: `${protagonistName}从平凡到超凡的主线成长轨迹，贯穿全书的终极目标`,
        type: 'main',
        status: 'active', priority: 'critical', sortOrder: 0,
        materialIds: [], chapterIds: [], timelineEventIds: [],
        progress: 0, notes: '系统自动生成的主线任务',
        tags: ['主线', '自动生成'], createdAt: now, updatedAt: now
    };
    await store.setItem('quests', id, quest);
    return { quest, created: true };
}

async function createPhaseQuests(projectId, mainQuestId, sortedChapters, existingPhaseQuests) {
    const now = new Date().toISOString();
    let created = 0;
    let phaseOrder = 0;
    const phaseMap = {};

    for (let i = 0; i < sortedChapters.length; i += PHASE_SIZE) {
        const phaseChapters = sortedChapters.slice(i, i + PHASE_SIZE);
        const startCh = phaseChapters[0].chapterNumber;
        const endCh = phaseChapters[phaseChapters.length - 1].chapterNumber;
        const phaseIdx = Math.floor(i / PHASE_SIZE);
        const phaseName = PHASE_NAMES[phaseIdx] || `第${phaseIdx + 1}卷`;

        const existingPhase = existingPhaseQuests[phaseIdx];
        let phaseQuestId;
        if (existingPhase) {
            phaseQuestId = existingPhase.id;
        } else {
            phaseQuestId = uuidv4();
            await store.setItem('quests', phaseQuestId, {
                id: phaseQuestId, projectId, parentId: mainQuestId,
                title: phaseName, description: `第${startCh}-${endCh}章的故事弧线`,
                type: 'phase',
                status: phaseIdx === 0 ? 'active' : 'planned', priority: 'high',
                sortOrder: phaseOrder, materialIds: [],
                chapterIds: phaseChapters.map(c => c.id), timelineEventIds: [],
                progress: 0, notes: '', tags: ['阶段任务', '自动生成'],
                createdAt: now, updatedAt: now
            });
            created++;
        }
        phaseMap[phaseIdx] = { id: phaseQuestId, startCh, endCh, chapters: phaseChapters };
        phaseOrder++;
    }
    return { phaseMap, created };
}

async function createSubplaneQuests(projectId, mainQuestId) {
    const now = new Date().toISOString();
    let created = 0;
    const subPlanes = (await store.listItems('materials')).filter(m => m.projectId === projectId && m.type === 'sub-plane' && !m.archived);
    for (const sp of subPlanes) {
        const spQuestId = uuidv4();
        await store.setItem('quests', spQuestId, {
            id: spQuestId, projectId, parentId: mainQuestId,
            title: `位面探索·${sp.name}`,
            description: `探索小世界"${sp.name}"，完成该位面的核心挑战`,
            type: 'side',
            status: 'planned', priority: 'normal',
            sortOrder: 100 + subPlanes.indexOf(sp),
            materialIds: [sp.id], chapterIds: [], timelineEventIds: [],
            progress: 0, notes: '', tags: ['位面探索', '自动生成'],
            createdAt: now, updatedAt: now
        });
        created++;
    }
    return created;
}

async function createTimelineEvents(projectId, sortedChapters, existingTimelines, phaseMap, project) {
    const now = new Date().toISOString();
    const existingChapterIds = new Set(existingTimelines.flatMap(t => t.chapterIds || []));
    let created = 0, skipped = 0, eventOrder = existingTimelines.length;

    for (const ch of sortedChapters) {
        if (existingChapterIds.has(ch.id)) { skipped++; continue; }
        const content = ch.content || ch.outline || ch.currentContent || '';
        const outline = ch.outline || ch.title || '';
        const text = content || outline;
        if (!text && !ch.title) { skipped++; continue; }

        const eventType = detectEventType(text || ch.title);
        const phaseIdx = Math.floor((sortedChapters.indexOf(ch)) / PHASE_SIZE);

        const event = {
            id: uuidv4(), projectId,
            title: ch.title || `第${ch.chapterNumber}章事件`,
            description: outline ? (outline.length > 200 ? outline.substring(0, 200) + '...' : outline) : '',
            eventType, storyOrder: eventOrder, sortOrder: eventOrder,
            storyTime: inferStoryTime(ch.chapterNumber, project),
            chapterIds: [ch.id],
            questIds: phaseMap[phaseIdx] ? [phaseMap[phaseIdx].id] : [],
            materialIds: [], characterIds: [],
            location: extractLocation(text),
            importance: ch.chapterNumber <= 3 ? 'high' : 'normal',
            isKeyEvent: isKeyEvent(text, ch.chapterNumber),
            notes: '', tags: [`第${ch.chapterNumber}章`, '自动生成'],
            createdAt: now, updatedAt: now
        };
        await store.setItem('timelines', event.id, event);
        created++;
        eventOrder++;

        if (phaseMap[phaseIdx]) {
            phaseMap[phaseIdx].timelineEventIds = [...(phaseMap[phaseIdx].timelineEventIds || []), event.id];
        }
    }
    return { created, skipped };
}

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
    if (genre.includes('高武') || genre.includes('玄幻') || genre.includes('修仙')) return `灵元纪年·第${Math.ceil(chapterNumber / 5)}期`;
    if (genre.includes('都市') || genre.includes('现代')) return `第${Math.ceil(chapterNumber / 5)}周`;
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

module.exports = { ensureMainQuest, createPhaseQuests, createSubplaneQuests, createTimelineEvents, detectEventType, inferStoryTime, extractLocation, isKeyEvent };
