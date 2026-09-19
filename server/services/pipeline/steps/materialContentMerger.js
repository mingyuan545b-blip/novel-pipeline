'use strict';

/**
 * materialContentMerger.js — 素材内容合并（防章节状态覆盖人设）
 *
 * 规则：
 *   1. 以"【标签】"分节解析新旧内容
 *   2. 旧内容的所有标签都保留；同名标签按规则取用新值或保留更丰富的一版
 *      - 状态类标签（当前状态/基本信息…）→ 用新值（章节推进以新为准）
 *      - 其他人设类标签 → 取更长的一版（防止深度退化）
 *   3. 新内容里出现的新标签 → 追加到末尾
 *   4. 任一侧无法分节时返回 null，调用方回退原行为
 */
const logger = require('../../../shared/logger');
const { MATERIAL_CONTENT_POLICY } = require('../../../config/materialContentPolicy');
const { pruneContent } = require('./materialContentPruner');

// 配置缺失时显式报错，避免"正则退化成逐字符匹配"这种静默错误
if (!MATERIAL_CONTENT_POLICY.sectionPattern) throw new Error('materialContentPolicy.sectionPattern 缺失');
const SECTION_RE = new RegExp(MATERIAL_CONTENT_POLICY.sectionPattern, 'g');

/** 解析【标签】分节内容；无标签时返回 null */
function parseSections(text) {
    if (!text || typeof text !== 'string') return null;
    const matches = [...text.matchAll(SECTION_RE)];
    if (matches.length === 0) return null;
    const sections = [];
    for (let i = 0; i < matches.length; i++) {
        const label = matches[i][1];
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        sections.push({ label, text: text.substring(start, end).trim() });
    }
    const preamble = text.substring(0, matches[0].index).trim();
    return { preamble, sections };
}

/**
 * 合并旧内容与本章更新内容
 * @returns {string|null} 合并结果；无法合并时 null
 */
function mergeMaterialContent(existingContent, incomingContent) {
    const oldParsed = parseSections(existingContent);
    const newParsed = parseSections(incomingContent);
    if (!oldParsed || !newParsed) return null;

    const stateLabels = MATERIAL_CONTENT_POLICY.stateSectionLabels;
    const newByLabel = new Map(newParsed.sections.map((s) => [s.label, s.text]));
    const merged = [];
    const usedLabels = new Set();

    for (const sec of oldParsed.sections) {
        const incoming = newByLabel.get(sec.label);
        usedLabels.add(sec.label);
        if (!incoming) { merged.push(sec.text); continue; }
        if (stateLabels.includes(sec.label)) merged.push(incoming);
        else merged.push(incoming.length >= sec.text.length ? incoming : sec.text);
    }
    for (const sec of newParsed.sections) {
        if (!usedLabels.has(sec.label)) merged.push(sec.text);
    }

    const head = oldParsed.preamble || newParsed.preamble || '';
    const result = (head ? head + '\n' : '') + merged.join('\n');
    logger.info('materialContentMerger', `内容合并: ${existingContent.length}字 + 更新${incomingContent.length}字 → ${result.length}字`);
    return result;
}

/**
 * 以"更丰富的基线"合并：initialContent 是人设基座，currentContent 是章节演进的累积。
 * 取更长的作为基线，避免任一方被短内容冲掉（陷阱清单 P0：素材深度字段被覆盖）。
 */
function mergeWithBaseline(initialContent, currentContent, incoming, options = {}) {
    const base = (initialContent || '').length > (currentContent || '').length ? initialContent : currentContent;
    const merged = mergeMaterialContent(base, incoming);
    if (!merged) return merged;
    // 防膨胀：事件类滚动窗口 + 单素材字数上限（人设类永不整段删除）
    const parsed = parseSections(merged);
    const { text, report } = pruneContent(parsed, options.type || 'default');
    if (report.dropped.length || report.truncatedFields.length) {
        logger.info('materialContentMerger', '防膨胀报告: ' + JSON.stringify(report));
    }
    return text || merged;
}

module.exports = { mergeMaterialContent, mergeWithBaseline, parseSections };
