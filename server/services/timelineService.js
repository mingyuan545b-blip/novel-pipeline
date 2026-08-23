const store = require('../store');
const logger = require('../shared/logger');

const TIMELINE_TYPE = 'timeline-events';

const EVENT_TYPES = {
    BATTLE: 'battle', MEETING: 'meeting', DISCOVERY: 'discovery',
    TRAVEL: 'travel', DEATH: 'death', BIRTH: 'birth',
    CEREMONY: 'ceremony', BETRAYAL: 'betrayal',
    ALLIANCE: 'alliance', BREAKTHROUGH: 'breakthrough', CUSTOM: 'event'
};

const SIGNIFICANCE_LEVELS = {
    CRITICAL: 'critical', MAJOR: 'major', NORMAL: 'normal', MINOR: 'minor'
};

async function addEvent(projectId, event) {
    if (!projectId) throw new Error('projectId is required');
    if (!event.description) throw new Error('event.description is required');
    if (event.chapterNumber === undefined || event.chapterNumber === null) throw new Error('event.chapterNumber is required');

    const id = event.id || `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
        id, projectId, chapterNumber: event.chapterNumber,
        eventTime: event.eventTime || '', eventType: event.eventType || EVENT_TYPES.CUSTOM,
        actorIds: event.actorIds || [], locationId: event.locationId || '',
        description: event.description, precedingEventIds: event.precedingEventIds || [],
        duration: event.duration || '', significance: event.significance || SIGNIFICANCE_LEVELS.NORMAL,
        storyline: event.storyline || (event.significance === 'major' || event.significance === 'critical' ? 'main' : 'sub'),
        data: event.data || {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await store.setItem(TIMELINE_TYPE, id, entry);
    logger.info('timeline', `Event added: "${entry.description.substring(0, 30)}" in ch${entry.chapterNumber} (${entry.eventType})`);
    return entry;
}

async function addEvents(projectId, events) {
    const results = [];
    for (const event of events) { results.push(await addEvent(projectId, event)); }
    return results;
}

async function getEventsForChapter(projectId, chapterNumber) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    return all.filter(e => e.chapterNumber === chapterNumber).sort((a, b) => (a.eventTime || '').localeCompare(b.eventTime || ''));
}

async function getEvents(projectId, filters = {}) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    let filtered = all;
    if (filters.chapterNumber !== undefined) filtered = filtered.filter(e => e.chapterNumber === filters.chapterNumber);
    if (filters.eventType) filtered = filtered.filter(e => e.eventType === filters.eventType);
    return filtered.sort((a, b) => a.chapterNumber - b.chapterNumber || (a.eventTime || '').localeCompare(b.eventTime || ''));
}

async function getEventsForRange(projectId, fromChapter, toChapter) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    return all.filter(e => e.chapterNumber >= fromChapter && e.chapterNumber <= toChapter)
        .sort((a, b) => a.chapterNumber - b.chapterNumber || (a.eventTime || '').localeCompare(b.eventTime || ''));
}

async function getRecentEvents(projectId, currentChapter, lookbackChapters = 5) {
    const fromChapter = Math.max(1, currentChapter - lookbackChapters);
    return await getEventsForRange(projectId, fromChapter, currentChapter - 1);
}

async function getCausalChain(projectId, eventId, maxDepth = 10) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    const eventMap = new Map(all.map(e => [e.id, e]));
    const chain = [];
    const visited = new Set();
    let currentId = eventId;
    while (currentId && !visited.has(currentId) && chain.length < maxDepth) {
        visited.add(currentId);
        const event = eventMap.get(currentId);
        if (!event) break;
        chain.push(event);
        const preceding = event.precedingEventIds || [];
        currentId = preceding.length > 0 ? preceding[0] : null;
    }
    return chain;
}

async function getEventsForEntity(projectId, entityId) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    return all.filter(e => (e.actorIds || []).includes(entityId) || e.locationId === entityId);
}

async function getEventsForLocation(projectId, locationId) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    return all.filter(e => e.locationId === locationId).sort((a, b) => a.chapterNumber - b.chapterNumber);
}

async function deleteEventsForChapter(projectId, chapterNumber) {
    const events = await getEventsForChapter(projectId, chapterNumber);
    for (const event of events) { await store.deleteItem(TIMELINE_TYPE, event.id); }
    logger.info('timeline', `Deleted ${events.length} events for ch${chapterNumber} in project ${projectId}`);
    return events.length;
}

async function deleteEvent(projectId, eventId) {
    const event = await store.getItem(TIMELINE_TYPE, eventId);
    if (!event) return null;
    await store.deleteItem(TIMELINE_TYPE, eventId);
    logger.info('timeline', `Deleted event ${eventId} in project ${projectId}`);
    return event;
}

async function updateEvent(eventId, updates) {
    const event = await store.getItem(TIMELINE_TYPE, eventId);
    if (!event) return null;
    for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'projectId' || key === 'createdAt') continue;
        event[key] = value;
    }
    event.updatedAt = new Date().toISOString();
    await store.setItem(TIMELINE_TYPE, eventId, event);
    return event;
}

async function getStats(projectId) {
    const all = await store.queryItems(TIMELINE_TYPE, { projectId });
    const typeCounts = {};
    const significanceCounts = {};
    for (const e of all) {
        typeCounts[e.eventType || 'event'] = (typeCounts[e.eventType || 'event'] || 0) + 1;
        significanceCounts[e.significance || 'normal'] = (significanceCounts[e.significance || 'normal'] || 0) + 1;
    }
    return {
        total: all.length, typeCounts, significanceCounts,
        chapterRange: all.length > 0 ? { min: Math.min(...all.map(e => e.chapterNumber || 0)), max: Math.max(...all.map(e => e.chapterNumber || 0)) } : null
    };
}

async function generateTimelineSummary(projectId, currentChapter, lookbackChapters = 5, tokenBudget = 800) {
    const events = await getRecentEvents(projectId, currentChapter, lookbackChapters);
    if (events.length === 0) return '';
    const mainLines = [];
    const subLines = [];
    let budgetUsed = 0;
    for (const e of events) {
        const timeLabel = e.eventTime ? `[${e.eventTime}]` : '';
        const actorLabel = (e.actorIds || []).length > 0 ? `（角色×${e.actorIds.length}）` : '';
        const line = `第${e.chapterNumber}章 ${timeLabel} ${e.description}${actorLabel}`;
        const tokens = Math.ceil(line.length / 2);
        if (budgetUsed + tokens > tokenBudget) break;
        const storyline = e.storyline || e.data?.storyline || (e.significance === 'major' || e.significance === 'critical' ? 'main' : 'sub');
        if (storyline === 'main') mainLines.push(line);
        else subLines.push(line);
        budgetUsed += tokens;
    }
    const parts = [];
    if (mainLines.length > 0) parts.push(`【主线时间线 - 必须延续】\n${mainLines.join('\n')}`);
    if (subLines.length > 0) parts.push(`【支线时间线】\n${subLines.join('\n')}`);
    return parts.join('\n\n');
}

async function detectTimeConflicts(projectId, chapterNumber) {
    const events = await getEventsForChapter(projectId, chapterNumber);
    const conflicts = [];
    const actorEvents = new Map();
    for (const e of events) {
        for (const actorId of (e.actorIds || [])) {
            if (!actorEvents.has(actorId)) actorEvents.set(actorId, []);
            actorEvents.get(actorId).push(e);
        }
    }
    for (const [actorId, actorEventList] of actorEvents) {
        if (actorEventList.length <= 1) continue;
        const locations = new Set(actorEventList.map(e => e.locationId).filter(Boolean));
        if (locations.size > 1) {
            conflicts.push({ actorId, events: actorEventList.map(e => e.id), locations: [...locations], description: `角色${actorId}在同一章内出现在不同地点` });
        }
    }
    return conflicts;
}

function getTimeGap(eventA, eventB) {
    if (!eventA?.eventTime || !eventB?.eventTime) return null;
    return { fromEvent: eventA.id, toEvent: eventB.id, fromTime: eventA.eventTime, toTime: eventB.eventTime, chapterGap: Math.abs((eventB.chapterNumber || 0) - (eventA.chapterNumber || 0)) };
}

// Backward-compatible singleton (callers use timelineService.xxx())
const timelineService = {
    addEvent, addEvents, getEvents, getEventsForChapter, getEventsForRange,
    getRecentEvents, getCausalChain, getEventsForEntity, getEventsForLocation,
    deleteEventsForChapter, deleteEvent, updateEvent, getStats, generateTimelineSummary,
    detectTimeConflicts, getTimeGap
};

module.exports = {
    timelineService,
    TimelineService: timelineService,
    TIMELINE_TYPE, EVENT_TYPES, SIGNIFICANCE_LEVELS,
    addEvent, addEvents, getEvents, getEventsForChapter, getEventsForRange,
    getRecentEvents, getCausalChain, getEventsForEntity, getEventsForLocation,
    deleteEventsForChapter, deleteEvent, updateEvent, getStats, generateTimelineSummary,
    detectTimeConflicts, getTimeGap
};
