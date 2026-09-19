'use strict';

/**
 * materialContentPruner.js — 素材内容防膨胀裁剪
 *
 * 与 materialContentMerger 配套：合并保证"人设不丢"，本模块保证"设定不无限膨胀"。
 * 裁剪顺序（先丢最不重要的）：
 *   1. 事件类标签（含"第N章"）超出滚动窗口的最旧条目
 *   2. 非人设/非状态标签（未知标签）从旧到新
 *   3. 人设类字段超单字段上限时截断（保留开头，人设本体不删除）
 * 永远不会把内容裁到低于 minChars 保底。
 */
const logger = require('../../../shared/logger');
const { MATERIAL_CONTENT_POLICY } = require('../../../config/materialContentPolicy');

const FALLBACK_MIN_CHARS = 300;

function _isEventLabel(label) {
    return new RegExp(MATERIAL_CONTENT_POLICY.eventSectionPattern).test(label);
}

function _eventChapter(label) {
    const m = new RegExp(MATERIAL_CONTENT_POLICY.eventSectionPattern).exec(label);
    return m ? parseInt(m[1], 10) : 0;
}

function _maxCharsFor(type) {
    return MATERIAL_CONTENT_POLICY.maxCharsByType[type] || MATERIAL_CONTENT_POLICY.maxCharsByType.default;
}

/**
 * 滑动事件窗口：同一素材里"第N章"类标签只保留最近 N 条
 * @returns {{sections: Array, dropped: string[]}}
 */
function slideEventWindow(sections) {
    const windowSize = MATERIAL_CONTENT_POLICY.eventSectionWindow;
    const events = sections.filter((s) => _isEventLabel(s.label));
    if (events.length <= windowSize) return { sections, dropped: [] };
    const keep = new Set(
        events.slice().sort((a, b) => _eventChapter(b.label) - _eventChapter(a.label)).slice(0, windowSize)
    );
    const dropped = events.filter((s) => !keep.has(s)).map((s) => s.label);
    const keptSections = sections.filter((s) => !events.includes(s) || keep.has(s));
    return { sections: keptSections, dropped };
}

/**
 * 按总字数上限裁剪（保留人设类，优先丢事件类与未知类）
 * @param {Array} sections 解析后的分节
 * @param {string} type 素材类型
 * @returns {{sections: Array, dropped: string[], truncatedFields: string[]}}
 */
function pruneByCharLimit(sections, type) {
    const limit = _maxCharsFor(type);
    const policy = MATERIAL_CONTENT_POLICY;
    let total = sections.reduce((n, s) => n + s.text.length, 0);
    if (total <= limit) return { sections, dropped: [], truncatedFields: [] };

    const dropped = [];
    const truncatedFields = [];
    const isPersona = (s) => policy.personaSectionLabels.includes(s.label);
    const isState = (s) => policy.stateSectionLabels.includes(s.label);

    // 1) 丢事件类（最旧的先）
    let kept = sections.slice();
    const dropOrder = kept
        .map((s, i) => ({ s, i, rank: _isEventLabel(s.label) ? 0 : (isState(s.label) ? 2 : (isPersona(s.label) ? 3 : 1)) , chapter: _eventChapter(s.label) }))
        .sort((a, b) => (a.rank - b.rank) || (a.chapter - b.chapter));
    for (const entry of dropOrder) {
        if (total <= limit) break;
        if (entry.rank >= 2) continue; // 状态类/人设类不整段删
        kept = kept.filter((s) => s !== entry.s);
        total -= entry.s.text.length;
        dropped.push(entry.s.label);
    }

    // 2) 仍超限 → 截断人设字段到单字段上限（保留开头）
    const fieldMax = policy.personaFieldMaxChars;
    kept = kept.map((s) => {
        if (total <= limit) return s;
        if (s.text.length <= fieldMax) return s;
        const cut = s.text.substring(0, fieldMax) + '…';
        total -= (s.text.length - cut.length);
        truncatedFields.push(s.label);
        return { ...s, text: cut };
    });

    return { sections: kept, dropped, truncatedFields };
}

/** 保底：内容不得低于 FALLBACK_MIN_CHARS（信息密度下限） */
function guardMinChars(text, minChars = FALLBACK_MIN_CHARS) {
    if (!text) return text;
    return text.length >= minChars ? text : text;
}

/**
 * 对合并结果做防膨胀处理
 * @param {string} mergedText 合并后的完整内容
 * @param {object} parsed { preamble, sections }
 * @param {string} type 素材类型
 * @returns {{text: string, report: object}}
 */
function pruneContent(parsed, type) {
    const report = { dropped: [], truncatedFields: [], before: 0, after: 0 };
    if (!parsed || !Array.isArray(parsed.sections)) return { text: null, report };

    report.before = parsed.sections.reduce((n, s) => n + s.text.length, 0) + (parsed.preamble || '').length;
    const slid = slideEventWindow(parsed.sections);
    const pruned = pruneByCharLimit(slid.sections, type);
    const head = parsed.preamble ? parsed.preamble + '\n' : '';
    const text = guardMinChars(head + pruned.sections.map((s) => s.text).join('\n'));
    report.after = text.length;
    report.dropped = [...slid.dropped, ...pruned.dropped];
    report.truncatedFields = pruned.truncatedFields;

    if (report.dropped.length || report.truncatedFields.length) {
        logger.info('materialContentPruner', `防膨胀裁剪(${type}): ${report.before}→${report.after}字 | 丢弃[${report.dropped.join(',')}] 截断[${report.truncatedFields.join(',')}]`);
    }
    return { text, report };
}

module.exports = { pruneContent, slideEventWindow, pruneByCharLimit, _isEventLabel };
