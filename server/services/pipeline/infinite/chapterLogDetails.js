'use strict';

/**
 * chapterLogDetails.js — 流水线执行日志的细节文本构建
 * 从 chapterExecutor.js 拆出（2026-09-18，主文件超200行限制）。
 * 目的：日志不止显示"R1/R2 几轮"，还要给出 章节/字数/失败步骤/具体问题，
 * 便于在"执行日志"里一眼看出卡在哪、差多少。
 */

/** 字数不达标细节：当前字数 + 最低要求 + 前两条问题 */
function wordCountDetail(uc, result) {
    const parts = [];
    if (uc && typeof uc.wordCount === 'number') parts.push(`当前${uc.wordCount}字`);
    if (uc && uc._wordCountDetail) parts.push(String(uc._wordCountDetail).substring(0, 80));
    const issues = (result?.lastFeedback?.issues || []).map((i) => i.desc || i.description).filter(Boolean);
    if (issues.length) parts.push(issues.slice(0, 2).join(' ｜ '));
    return parts.join(' ｜ ').substring(0, 200);
}

/** 审核未通过细节：失败步骤 + 前两条问题 */
function reviewFailDetail(result) {
    const parts = [];
    if (result?.message) parts.push(result.message);
    const issues = (result?.lastFeedback?.issues || []).map((i) => i.desc || i.description).filter(Boolean);
    if (issues.length) parts.push(issues.slice(0, 2).join(' ｜ '));
    return parts.join(' ｜ ').substring(0, 200);
}

/** 步骤级细节：结论摘要 + 前两条问题（空白则返回空串，由前端回退显示 msg） */
function stepDetail(feedback) {
    const summary = feedback?.summary || '';
    const issues = (feedback?.issues || []).map((i) => i.desc || i.description).filter(Boolean);
    return [summary, ...issues.slice(0, 2)].filter(Boolean).join(' ｜ ').substring(0, 200);
}

/** 意图规划细节：保持/避免/冲突/钩子/伏笔推进回收 */
function intentPlannerDetail(feedback) {
    const parts = [];
    if (feedback?.mustKeep?.length) parts.push(`✅保持: ${feedback.mustKeep.join(' | ')}`);
    if (feedback?.mustAvoid?.length) parts.push(`🚫避免: ${feedback.mustAvoid.join(' | ')}`);
    if (feedback?.conflictDesign) parts.push(`⚔️冲突: ${feedback.conflictDesign}`);
    if (feedback?.chapterEndHook) parts.push(`🪝钩子: ${feedback.chapterEndHook}`);
    if (feedback?.hookAdvance?.length) parts.push(`📌推进: ${feedback.hookAdvance.join(' | ')}`);
    if (feedback?.hookResolve?.length) parts.push(`🔓回收: ${feedback.hookResolve.join(' | ')}`);
    return parts.join(' → ').substring(0, 200);
}

module.exports = { wordCountDetail, reviewFailDetail, stepDetail, intentPlannerDetail };
