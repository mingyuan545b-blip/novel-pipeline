/**
 * timelineContextResolver.js — 时间轴主线/支线上下文解析
 * 整合 timeline-events + foreshadow-ledger + timelines + quests 四个数据源
 * 按主线/支线分类输出，供writer/reviser消费
 */
const store = require('../../store');
const logger = require('../../shared/logger');

const TIMELINE_PRIORITY = {
    main:     { label: '主线', depth: 'L2', maxEvents: 10 },
    sub:      { label: '支线', depth: 'L1', maxEvents: 5 },
    flashback:{ label: '回忆', depth: 'L0', maxEvents: 3 },
    parallel: { label: '并行', depth: 'L0', maxEvents: 3 },
};

const DISTANCE_DECAY = {
    currentChapter:  { depthBoost: 2, maxLookback: 1 },
    recentChapters:  { depthBoost: 1, maxLookback: 5 },
    olderChapters:   { depthBoost: 0, maxLookback: 20 },
    ancientChapters: { depthBoost: -1, maxLookback: Infinity },
};

/**
 * 解析项目时间轴上下文（四源整合）
 * @param {string} projectId
 * @param {number} currentChapter
 * @returns {object} { mainEvents, subEvents, mainForeshadows, subForeshadows, contextSummary }
 */
async function resolveTimelineContext(projectId, currentChapter) {
    const [legacyTimelines, quests, timelineEvents, foreshadows] = await Promise.all([
        _loadTimelines(projectId),
        _loadQuests(projectId),
        _loadTimelineEvents(projectId),
        _loadForeshadows(projectId),
    ]);

    const allEvents = _mergeEventSources(legacyTimelines, timelineEvents);
    const classified = _classifyByStoryline(allEvents, quests);
    const adjusted = _applyDistanceDecay(classified, currentChapter);

    const mainEvents = _selectEvents(adjusted.main, TIMELINE_PRIORITY.main, currentChapter);
    const subEvents = _selectEvents(adjusted.sub, TIMELINE_PRIORITY.sub, currentChapter);

    const mainForeshadows = foreshadows.filter(f => f.storyline === 'main' && _isActiveForeshadow(f));
    const subForeshadows = foreshadows.filter(f => f.storyline !== 'main' && _isActiveForeshadow(f));

    return {
        mainEvents,
        subEvents,
        mainForeshadows,
        subForeshadows,
        contextSummary: _buildSummary(mainEvents, subEvents, mainForeshadows, subForeshadows),
        meta: {
            totalEvents: allEvents.length,
            mainEventCount: adjusted.main.length,
            subEventCount: adjusted.sub.length,
            mainForeshadowCount: mainForeshadows.length,
            subForeshadowCount: subForeshadows.length,
        },
    };
}

async function _loadTimelines(projectId) {
    try { return await store.queryItems('timelines', { projectId }); } catch (_) { return []; }
}

async function _loadQuests(projectId) {
    try { return await store.queryItems('quests', { projectId }); } catch (_) { return []; }
}

async function _loadTimelineEvents(projectId) {
    try { return await store.queryItems('timeline-events', { projectId }); } catch (_) { return []; }
}

async function _loadForeshadows(projectId) {
    try { return await store.queryItems('foreshadow-ledger', { projectId }); } catch (_) { return []; }
}

function _isActiveForeshadow(f) {
    return f.status === 'planted' || f.status === 'advanced';
}

/** 合并旧timelines和新timeline-events，去重 */
function _mergeEventSources(legacyTimelines, timelineEvents) {
    const seen = new Set();
    const merged = [];
    for (const ev of timelineEvents) {
        const key = `${ev.chapterNumber || ev.chapter || 0}-${ev.eventType || 'event'}-${(ev.description || '').substring(0, 50)}`;
        if (!seen.has(key)) { seen.add(key); merged.push(ev); }
    }
    for (const ev of legacyTimelines) {
        const key = `${ev.chapter || ev.chapterNumber || 0}-${ev.eventType || 'event'}-${(ev.description || ev.event || '').substring(0, 50)}`;
        if (!seen.has(key)) { seen.add(key); merged.push(ev); }
    }
    return merged;
}

function _classifyByStoryline(events, quests) {
    const mainQuestIds = new Set(
        quests.filter(q => !q.parentId || q.priority === 'critical').map(q => q.id)
    );
    const main = [];
    const sub = [];
    for (const ev of events) {
        const isMain = (ev.questId && mainQuestIds.has(ev.questId)) ||
                       ev.storyline === 'main' ||
                       ev.priority === 'critical' ||
                       ev.significance === 'major' || ev.significance === 'critical';
        (isMain ? main : sub).push(ev);
    }
    return { main, sub };
}

function _applyDistanceDecay(classified, currentChapter) {
    const adjust = (events) => events.map(ev => {
        const evChapter = ev.chapter || ev.chapterNumber || 0;
        const distance = currentChapter - evChapter;
        const decay = _getDecayRule(distance);
        return { ...ev, distance, depthBoost: decay.depthBoost };
    });
    return { main: adjust(classified.main), sub: adjust(classified.sub) };
}

function _getDecayRule(distance) {
    if (distance <= 0) return DISTANCE_DECAY.currentChapter;
    if (distance <= 5) return DISTANCE_DECAY.recentChapters;
    if (distance <= 20) return DISTANCE_DECAY.olderChapters;
    return DISTANCE_DECAY.ancientChapters;
}

function _selectEvents(events, config, currentChapter) {
    const sorted = events
        .filter(e => (e.chapter || e.chapterNumber || 0) <= currentChapter)
        .sort((a, b) => {
            const distA = Math.abs((a.chapter || a.chapterNumber || 0) - currentChapter);
            const distB = Math.abs((b.chapter || b.chapterNumber || 0) - currentChapter);
            return distA - distB;
        })
        .slice(0, config.maxEvents);
    return sorted.map(ev => ({
        chapter: ev.chapter || ev.chapterNumber,
        event: ev.event || ev.description || ev.title || '',
        depth: _resolveEventDepth(config.depth, ev.depthBoost),
        storyline: config.label,
    }));
}

function _resolveEventDepth(baseDepth, boost) {
    const num = parseInt(baseDepth.replace('L', ''), 10) + (boost || 0);
    return `L${Math.max(0, Math.min(4, num))}`;
}

function _buildSummary(mainEvents, subEvents, mainForeshadows, subForeshadows) {
    const parts = [];
    if (mainEvents.length > 0) {
        parts.push('【主线时间轴 - 必须延续】\n' + mainEvents.map(e => `第${e.chapter}章: ${e.event}`).join('\n'));
    }
    if (subEvents.length > 0) {
        parts.push('【支线时间轴】\n' + subEvents.map(e => `第${e.chapter}章: ${e.event}`).join('\n'));
    }
    if (mainForeshadows.length > 0) {
        parts.push('【主线伏笔 - 必须推进】\n' + mainForeshadows.map(f =>
            `▸ "${f.name}"（第${f.plantChapter}章埋设，${f.status === 'advanced' ? '已推进' : '待推进'}）`
        ).join('\n'));
    }
    if (subForeshadows.length > 0) {
        parts.push('【支线伏笔】\n' + subForeshadows.map(f =>
            `▸ "${f.name}"（第${f.plantChapter}章埋设，${f.status === 'advanced' ? '已推进' : '待推进'}）`
        ).join('\n'));
    }
    return parts.join('\n\n');
}

module.exports = { resolveTimelineContext, TIMELINE_PRIORITY, DISTANCE_DECAY };
