/**
 * timelineExtractorHelpers.js — 时间线提取器辅助函数
 * 纯函数：事件关键词映射、时间指示词、角色匹配、事件提取
 */

const EVENT_TYPES = {
    BATTLE: 'battle', MEETING: 'meeting', DISCOVERY: 'discovery',
    TRAVEL: 'travel', DEATH: 'death', BIRTH: 'birth',
    CEREMONY: 'ceremony', BETRAYAL: 'betrayal',
    ALLIANCE: 'alliance', BREAKTHROUGH: 'breakthrough', CUSTOM: 'event'
};
const SIGNIFICANCE_LEVELS = {
    CRITICAL: 'critical', MAJOR: 'major', NORMAL: 'normal', MINOR: 'minor'
};

const EVENT_KEYWORD_MAP = [
    { keywords: ['战斗', '对决', '交手', '厮杀', '围攻', '突围'], type: EVENT_TYPES.BATTLE, significance: SIGNIFICANCE_LEVELS.MAJOR },
    { keywords: ['相遇', '初见', '重逢', '告别', '会面', '碰面'], type: EVENT_TYPES.MEETING, significance: SIGNIFICANCE_LEVELS.NORMAL },
    { keywords: ['发现', '揭露', '揭开', '暴露', '识破'], type: EVENT_TYPES.DISCOVERY, significance: SIGNIFICANCE_LEVELS.MAJOR },
    { keywords: ['离开', '出发', '抵达', '前往', '归来'], type: EVENT_TYPES.TRAVEL, significance: SIGNIFICANCE_LEVELS.NORMAL },
    { keywords: ['死亡', '牺牲', '陨落', '离世'], type: EVENT_TYPES.DEATH, significance: SIGNIFICANCE_LEVELS.CRITICAL },
    { keywords: ['出生', '诞生', '降生'], type: EVENT_TYPES.BIRTH, significance: SIGNIFICANCE_LEVELS.NORMAL },
    { keywords: ['婚礼', '仪式', '典礼', '加冕', '登基'], type: EVENT_TYPES.CEREMONY, significance: SIGNIFICANCE_LEVELS.MAJOR },
    { keywords: ['背叛', '出卖', '反叛', '倒戈'], type: EVENT_TYPES.BETRAYAL, significance: SIGNIFICANCE_LEVELS.CRITICAL },
    { keywords: ['结盟', '合作', '联手', '联盟'], type: EVENT_TYPES.ALLIANCE, significance: SIGNIFICANCE_LEVELS.MAJOR },
    { keywords: ['突破', '觉醒', '升级', '进化', '蜕变'], type: EVENT_TYPES.BREAKTHROUGH, significance: SIGNIFICANCE_LEVELS.MAJOR }
];

const TIME_INDICATORS = [
    { pattern: /(\d+)天后/, group: 'days' }, { pattern: /(\d+)个月后/, group: 'months' },
    { pattern: /(\d+)年后/, group: 'years' }, { pattern: /过了(\d+)天/, group: 'days' },
    { pattern: /过了(\d+)个月/, group: 'months' },
    { pattern: /第二天/, group: 'relative', value: '+1d' }, { pattern: /次日/, group: 'relative', value: '+1d' },
    { pattern: /翌日/, group: 'relative', value: '+1d' }, { pattern: /当天/, group: 'relative', value: '0d' },
    { pattern: /同一天/, group: 'relative', value: '0d' },
    { pattern: /傍晚/, group: 'timeofday', value: 'evening' }, { pattern: /黄昏/, group: 'timeofday', value: 'dusk' },
    { pattern: /深夜/, group: 'timeofday', value: 'night' }, { pattern: /凌晨/, group: 'timeofday', value: 'dawn' },
    { pattern: /午后/, group: 'timeofday', value: 'afternoon' }, { pattern: /上午/, group: 'timeofday', value: 'morning' },
    { pattern: /下午/, group: 'timeofday', value: 'afternoon' }, { pattern: /入夜/, group: 'timeofday', value: 'night' },
    { pattern: /黎明/, group: 'timeofday', value: 'dawn' }, { pattern: /正午/, group: 'timeofday', value: 'noon' }
];

function extractActorIdsFromText(text, characterNameMap) {
    const actorIds = [];
    for (const [name, id] of characterNameMap) {
        if (text.includes(name) && !actorIds.includes(id)) actorIds.push(id);
    }
    return actorIds;
}

function matchEventKeywords(paragraph) {
    for (const mapping of EVENT_KEYWORD_MAP) {
        for (const kw of mapping.keywords) {
            if (paragraph.includes(kw)) return { type: mapping.type, significance: mapping.significance, description: truncateEventDescription(paragraph) };
        }
    }
    return null;
}

function extractStructuredTime(text) {
    for (const ind of TIME_INDICATORS) {
        const match = text.match(ind.pattern);
        if (match) {
            let structured = null;
            if (ind.group === 'days') structured = { type: 'relative', unit: 'day', value: parseInt(match[1]) };
            else if (ind.group === 'months') structured = { type: 'relative', unit: 'month', value: parseInt(match[1]) };
            else if (ind.group === 'years') structured = { type: 'relative', unit: 'year', value: parseInt(match[1]) };
            else if (ind.group === 'relative') structured = { type: 'offset', value: ind.value };
            else if (ind.group === 'timeofday') structured = { type: 'timeofday', value: ind.value };
            return { display: match[0], structured };
        }
    }
    return { display: null, structured: null };
}

function truncateEventDescription(text) {
    return text.replace(/\n/g, ' ').trim().substring(0, 200);
}

function extractEventsFromIntent(intent, chapterNum, characterNameMap, ET, SL) {
    const events = [];
    const text = typeof intent === 'string' ? intent : JSON.stringify(intent);
    const cm = text.match(/冲突[：:](.*?)(?:\n|$)/);
    if (cm) events.push({ chapterNumber: chapterNum, eventTime: `第${chapterNum}章`, eventType: ET.CUSTOM, description: `冲突：${cm[1].substring(0, 150)}`, significance: SL.MAJOR, actorIds: extractActorIdsFromText(cm[1], characterNameMap), data: { source: 'intent-conflict' } });
    const hm = text.match(/章末钩子[：:](.*?)(?:\n|$)/);
    if (hm) events.push({ chapterNumber: chapterNum, eventTime: `第${chapterNum}章`, eventType: ET.DISCOVERY, description: `章末钩子：${hm[1].substring(0, 150)}`, significance: SL.NORMAL, actorIds: extractActorIdsFromText(hm[1], characterNameMap), data: { source: 'intent-hook' } });
    return events;
}

function extractEventsFromOutline(outlineText, chapterNum, characterNameMap, KWMAP) {
    const events = [];
    for (const mapping of KWMAP) {
        for (const kw of mapping.keywords) {
            if (outlineText.includes(kw)) {
                const idx = outlineText.indexOf(kw);
                const ctx = outlineText.substring(Math.max(0, idx - 20), Math.min(outlineText.length, idx + kw.length + 80));
                events.push({ chapterNumber: chapterNum, eventTime: `第${chapterNum}章`, eventType: mapping.type, description: ctx.replace(/\n/g, ' ').trim().substring(0, 200), significance: mapping.significance, actorIds: extractActorIdsFromText(ctx, characterNameMap), data: { source: 'outline-extraction' } });
                break;
            }
        }
    }
    return events;
}

module.exports = {
    EVENT_KEYWORD_MAP, TIME_INDICATORS,
    extractActorIdsFromText, matchEventKeywords, extractStructuredTime,
    truncateEventDescription, extractEventsFromIntent, extractEventsFromOutline
};
