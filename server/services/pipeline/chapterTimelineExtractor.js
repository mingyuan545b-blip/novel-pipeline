/**
 * chapterTimelineExtractor.js — 章节时间线与伏笔自动提取器
 * 提取：1.时间线事件(绑定角色ID+结构化时间) 2.伏笔状态变更(关联事件ID)
 * 幂等/角色绑定/伏笔-事件关联
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { timelineService, EVENT_TYPES, SIGNIFICANCE_LEVELS } = require('../timelineService');
const { foreshadowLedger } = require('../knowledgeBase');
const {
    EVENT_KEYWORD_MAP, TIME_INDICATORS,
    extractActorIdsFromText, matchEventKeywords, extractStructuredTime,
    truncateEventDescription, extractEventsFromIntent, extractEventsFromOutline
} = require('./timelineExtractorHelpers');
const {
    FORESHADOW_ADVANCE_KEYWORDS, FORESHADOW_RESOLVE_KEYWORDS,
    fuzzyMatchForeshadow, isNearKeyword,
    extractForeshadowNamesFromIntent, detectNewForeshadowSignals
} = require('./foreshadowExtractorHelpers');

/** 从章节正文提取时间线事件和伏笔状态 */
async function extractAndPersist(projectId, chapter, outlineText, intentResult) {
    const chapterNum = chapter.chapterNumber;
    const content = chapter.content || '';
    if (!content || content.length < 100) {
        logger.info('timelineExtractor', `Ch${chapterNum}: content too short, skipping`);
        return { timelineCount: 0, foreshadowCount: 0 };
    }
    const characterNameMap = await _buildCharacterNameMap(projectId);
    await timelineService.deleteEventsForChapter(projectId, chapterNum);

    const timelineEvents = _extractTimelineEvents(content, outlineText, chapterNum, intentResult, characterNameMap);
    const savedEventIds = [];
    let timelineCount = 0;
    for (const event of timelineEvents) {
        try {
            const saved = await timelineService.addEvent(projectId, event);
            savedEventIds.push(saved.id);
            timelineCount++;
        } catch (e) { logger.warn('timelineExtractor', `Failed to add timeline event: ${e.message}`); }
    }

    const foreshadowChanges = await _extractForeshadowChanges(projectId, content, chapterNum, intentResult, savedEventIds);
    let foreshadowCount = 0;
    for (const change of foreshadowChanges) {
        try {
            if (change.action === 'plant') {
                await foreshadowLedger.plant(projectId, change.name, change.description, {
                    plantChapter: chapterNum, importance: change.importance || 'normal',
                    storyline: change.storyline || 'sub',
                    relatedEntityIds: change.relatedEntityIds || [], relatedEventIds: change.relatedEventIds || []
                });
            } else if (change.action === 'advance') {
                await foreshadowLedger.advance(projectId, change.name, chapterNum, change.detail);
            } else if (change.action === 'resolve') {
                await foreshadowLedger.resolve(projectId, change.name, chapterNum, change.notes);
            }
            foreshadowCount++;
        } catch (e) { logger.warn('timelineExtractor', `Failed to update foreshadow: ${e.message}`); }
    }

    logger.info('timelineExtractor', `Ch${chapterNum}: extracted ${timelineCount} timeline events, ${foreshadowCount} foreshadow changes`);
    return { timelineCount, foreshadowCount };
}

async function _buildCharacterNameMap(projectId) {
    const nameMap = new Map();
    try {
        const entityCenter = require('../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        for (const entity of entities) {
            if (entity.name) nameMap.set(entity.name, entity.id);
            const aliases = entity.aliases || entity.data?.aliases || [];
            for (const alias of aliases) {
                if (alias && typeof alias === 'string') nameMap.set(alias, entity.id);
            }
        }
    } catch (e) { logger.warn('timelineExtractor', `Failed to build character name map: ${e.message}`); }
    return nameMap;
}

function _extractTimelineEvents(content, outlineText, chapterNum, intentResult, characterNameMap) {
    const events = [];
    const seenTypes = new Set();
    const seenDescriptions = new Set();

    const addUnique = (ev) => {
        const typeKey = `${ev.eventType}`;
        const descKey = ev.description.substring(0, 80);
        if (seenDescriptions.has(descKey)) return;
        if (seenTypes.has(typeKey)) return;
        seenTypes.add(typeKey);
        seenDescriptions.add(descKey);
        events.push(ev);
    };

    if (intentResult?.intent) {
        for (const ev of extractEventsFromIntent(intentResult.intent, chapterNum, characterNameMap, EVENT_TYPES, SIGNIFICANCE_LEVELS)) addUnique(ev);
    }

    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 20);
    for (const para of paragraphs) {
        const matched = matchEventKeywords(para);
        if (matched && !seenTypes.has(matched.type)) {
            const actorIds = extractActorIdsFromText(para, characterNameMap);
            const timeInfo = extractStructuredTime(para);
            addUnique({
                chapterNumber: chapterNum, eventTime: timeInfo.display || `第${chapterNum}章`,
                eventType: matched.type, description: truncateEventDescription(para),
                significance: matched.significance, actorIds, locationId: '',
                storyline: matched.significance === 'major' ? 'main' : 'sub',
                data: { source: 'content-extraction', timeInfo: timeInfo.structured || null }
            });
        }
    }

    if (outlineText) {
        for (const ev of extractEventsFromOutline(outlineText, chapterNum, characterNameMap, EVENT_KEYWORD_MAP)) {
            if (!seenTypes.has(ev.eventType)) addUnique(ev);
        }
    }

    return events.slice(0, 10);
}

async function _extractForeshadowChanges(projectId, content, chapterNum, intentResult, savedEventIds) {
    const changes = [];
    const intentNames = extractForeshadowNamesFromIntent(intentResult);
    const relIds = savedEventIds.slice(0, 3);

    const MAINLINE_KEYWORDS = ['核心', '关键', '主线', '终极', '最终', '根本', '命运', '宿命', '真相', '秘密'];
    function classifyStoryline(name, description) {
        const text = (name + ' ' + (description || '')).toLowerCase();
        return MAINLINE_KEYWORDS.some(kw => text.includes(kw)) ? 'main' : 'sub';
    }

    const active = await foreshadowLedger.getActive(projectId);
    for (const fs of active) {
        const nameInContent = fuzzyMatchForeshadow(fs.name, content);
        if (!nameInContent) continue;
        const isResolved = FORESHADOW_RESOLVE_KEYWORDS.some(kw => content.includes(kw)) &&
            isNearKeyword(content, nameInContent, FORESHADOW_RESOLVE_KEYWORDS, 200);
        if (isResolved) {
            changes.push({ action: 'resolve', name: fs.name, notes: `第${chapterNum}章回收`, relatedEventIds: relIds });
        } else {
            const isAdvanced = FORESHADOW_ADVANCE_KEYWORDS.some(kw => content.includes(kw)) || intentNames.some(n => n === fs.name);
            if (isAdvanced) changes.push({ action: 'advance', name: fs.name, detail: `第${chapterNum}章推进`, relatedEventIds: relIds });
        }
    }

    for (const name of intentNames) {
        const existing = await foreshadowLedger.findByName(projectId, name);
        if (!existing) changes.push({ action: 'plant', name, description: `第${chapterNum}章意图规划提及的伏笔`, importance: 'normal', storyline: classifyStoryline(name, ''), relatedEventIds: relIds });
    }

    for (const signal of detectNewForeshadowSignals(content)) {
        const existing = await foreshadowLedger.findByName(projectId, signal.name);
        if (!existing) changes.push({ action: 'plant', name: signal.name, description: signal.description, importance: 'normal', storyline: classifyStoryline(signal.name, signal.description), relatedEventIds: relIds });
    }

    return changes;
}

async function backfillTimeline(projectId) {
    const chapters = await store.queryItems('chapters', { projectId });
    let totalTimeline = 0, totalForeshadow = 0;
    for (const ch of chapters) {
        if (!ch.content || ch.content.length < 100) continue;
        const result = await extractAndPersist(projectId, ch, ch.outline || '', null);
        totalTimeline += result.timelineCount;
        totalForeshadow += result.foreshadowCount;
    }
    logger.info('timelineExtractor', `Backfill: ${totalTimeline} events, ${totalForeshadow} foreshadow, ${chapters.length} chapters`);
    return { totalTimeline, totalForeshadow, chapterCount: chapters.length };
}

module.exports = { extractAndPersist, backfillTimeline, EVENT_KEYWORD_MAP, TIME_INDICATORS, FORESHADOW_ADVANCE_KEYWORDS, FORESHADOW_RESOLVE_KEYWORDS };
