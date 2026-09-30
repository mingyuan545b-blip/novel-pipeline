'use strict';

/**
 * libraryCompleteness — 藏经阁技法条目「内容完整度」判定（纯函数，可单测）
 *
 * 背景（2026-10-01 用户反馈）：库里 207 条技法中有 184 条是**空壳** ——
 * `implementation_rules` / `anti_patterns` / `description` 全为空，只有名字和标签。
 * 前端此前不区分，用户只能一条条点进去试，"不知道哪些有数据、哪些是空的"。
 *
 * 本模块把"有没有内容"变成可排序、可筛选、可视觉降权的稳定字段。
 *
 * 判定口径（与提取解析层对齐）：解析层 `libraryExtractParse` 把
 * `implementation_rules < 2 条` 的条目判废，故规则数 ≥2 视为「可直接注入」。
 *
 * 文件位置：server/services/libraryCompleteness.js
 */

const LEVELS = Object.freeze({ FULL: 'full', PARTIAL: 'partial', EMPTY: 'empty' });

/** 规则条数达到此值视为"内容完整可注入"（与 libraryExtractParse 判废下限一致） */
const FULL_RULE_THRESHOLD = 2;

/**
 * 评估一条技法的内容完整度。
 * @param {object} tech 技法记录（libraryStore.normalize 之后的形状）
 * @returns {{level:string, hasRules:boolean, rulesCount:number, antiCount:number,
 *            hasDescription:boolean, score:number}}
 *   level: full（规则≥2，可直接注入）| partial（有部分内容）| empty（空壳，仅有名字标签）
 */
function assessCompleteness(tech) {
    const empty = { level: LEVELS.EMPTY, hasRules: false, rulesCount: 0, antiCount: 0, hasDescription: false, score: 0 };
    if (!tech) return empty;

    const rules = Array.isArray(tech.implementation_rules) ? tech.implementation_rules : [];
    const anti = Array.isArray(tech.anti_patterns) ? tech.anti_patterns : [];
    const rulesCount = rules.length;
    const antiCount = anti.length;
    const hasDescription = Boolean(tech.description && String(tech.description).trim());

    let level = LEVELS.EMPTY;
    if (rulesCount >= FULL_RULE_THRESHOLD) level = LEVELS.FULL;
    else if (rulesCount > 0 || antiCount > 0 || hasDescription) level = LEVELS.PARTIAL;

    // 排序权重：规则最重要，反模式次之，描述再次（仅用于前端"有内容优先"排序）
    const score = rulesCount * 10 + antiCount * 3 + (hasDescription ? 2 : 0);
    return { level, hasRules: rulesCount > 0, rulesCount, antiCount, hasDescription, score };
}

/** 供统计/来源面板聚合用的一行摘要 */
function summarize(list) {
    const arr = Array.isArray(list) ? list : [];
    const out = { total: arr.length, full: 0, partial: 0, empty: 0 };
    for (const t of arr) {
        const c = assessCompleteness(t);
        out[c.level] += 1;
    }
    return out;
}

module.exports = { LEVELS, FULL_RULE_THRESHOLD, assessCompleteness, summarize };
