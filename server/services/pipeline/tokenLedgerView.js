'use strict';

/**
 * tokenLedgerView.js — Token 去向面板视图组装（纯函数，无 IO）
 *
 * 输入：账本记录（tokenLedger）+ 装配实况（context-assemblies，提供场景/阶段）+ 各章字数
 * 输出：前端可直接渲染的总览 / 逐章 / 分步 / 分段 / 场景 / 趋势 / 告警
 *
 * 文件位置：server/services/pipeline/tokenLedgerView.js
 */
const { slotMeta, slotGroupLabel, sceneLabel, phaseLabel } = require('../../config/tokenSlotLabels');
// 步骤中文名复用既有唯一数据源（与流水线日志/文件命名一致）
const { AGENT_ROLE_NAMES } = require('../fileOutput');
const { buildTokenAlerts } = require('./tokenLedgerAlerts');

const num = (v) => (typeof v === 'number' && v > 0 ? v : 0);
const pct = (part, total) => (total > 0 ? Number((part / total * 100).toFixed(1)) : 0);

function aggregateSections(records) {
    const map = new Map();
    for (const r of records) {
        for (const s of r.promptSections || []) {
            const cur = map.get(s.slot) || { slot: s.slot, tokens: 0, lostTokens: 0, truncatedCount: 0 };
            cur.tokens += num(s.tokens);
            cur.lostTokens += num(s.lostTokens);
            if (s.wasTruncated) cur.truncatedCount += 1;
            map.set(s.slot, cur);
        }
    }
    const total = [...map.values()].reduce((sum, v) => sum + v.tokens, 0);
    return [...map.values()]
        .map(v => {
            const meta = slotMeta(v.slot);
            return { ...v, ...meta, groupLabel: slotGroupLabel(meta.group), share: pct(v.tokens, total) };
        })
        .sort((a, b) => b.tokens - a.tokens);
}

function aggregateSteps(records) {
    const map = new Map();
    for (const r of records) {
        const cur = map.get(r.step) || { step: r.step, tokens: 0, promptTokens: 0, completionTokens: 0, calls: 0, truncatedCount: 0 };
        cur.tokens += num(r.usage?.totalTokens);
        cur.promptTokens += num(r.usage?.promptTokens);
        cur.completionTokens += num(r.usage?.completionTokens);
        cur.calls += 1;
        cur.truncatedCount += (r.truncatedSlots || []).length;
        map.set(r.step, cur);
    }
    const total = [...map.values()].reduce((sum, v) => sum + v.tokens, 0);
    return [...map.values()]
        .map(v => ({
            ...v, stepLabel: AGENT_ROLE_NAMES[v.step] || v.step,
            share: pct(v.tokens, total), avgTokens: v.calls > 0 ? Math.round(v.tokens / v.calls) : 0,
        }))
        .sort((a, b) => b.tokens - a.tokens);
}

function sumUsage(records) {
    return records.reduce((acc, r) => {
        acc.promptTokens += num(r.usage?.promptTokens);
        acc.completionTokens += num(r.usage?.completionTokens);
        acc.totalTokens += num(r.usage?.totalTokens);
        acc.cachedTokens += num(r.usage?.cachedTokens);
        acc.outputChars += num(r.outputChars);
        return acc;
    }, { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, outputChars: 0 });
}

/**
 * 首轮 vs 返修轮 token 拆分（runRound>1 视为返修）
 *
 * reliable：只有本章同时存在"第1轮"与"第N轮"记录时，返修占比才有意义。
 * 续跑章节整章都在第N轮（日志里的相对轮次起点被抬高），若不做此判定会把
 * 整章 token 误报成"100% 花在返修轮"。
 */
function splitRounds(records) {
    let first = 0, retry = 0;
    for (const r of records) {
        if ((r.runRound || 1) > 1) retry += num(r.usage?.totalTokens);
        else first += num(r.usage?.totalTokens);
    }
    const hasFirstRound = records.some(r => (r.runRound || 1) === 1);
    return { firstRoundTokens: first, retryTokens: retry, reliable: hasFirstRound && retry > 0 };
}

function buildChapter(chapter, records, meta, wordCount) {
    const usage = sumUsage(records);
    const sections = aggregateSections(records);
    const steps = aggregateSteps(records);
    const rounds = splitRounds(records);
    const truncatedCount = records.reduce((n, r) => n + (r.truncatedSlots || []).length, 0);
    const lostTokens = sections.reduce((n, s) => n + s.lostTokens, 0);
    return {
        chapter,
        phase: meta?.phase || 'unknown',
        phaseLabel: phaseLabel(meta?.phase),
        sceneTypes: (meta?.sceneTypes || []).map(k => ({ key: k, label: sceneLabel(k) })),
        calls: records.length,
        wordCount: wordCount || 0,
        ...usage,
        cacheHitRate: pct(usage.cachedTokens, usage.promptTokens),
        tokensPerKChar: wordCount > 0 ? Math.round(usage.totalTokens / (wordCount / 1000)) : 0,
        truncatedCount,
        lostTokens,
        roundSplit: rounds,
        retryShare: pct(rounds.retryTokens, usage.totalTokens),
        byStep: steps,
        bySection: sections,
    };
}

/** 场景索引：同一场景横跨多章，供前端按场景筛选后重算占比 */
function buildScenes(chapters) {
    const map = new Map();
    for (const ch of chapters) {
        for (const s of ch.sceneTypes) {
            const cur = map.get(s.key) || { key: s.key, label: s.label, chapters: [], calls: 0, totalTokens: 0 };
            cur.chapters.push(ch.chapter);
            cur.calls += ch.calls;
            cur.totalTokens += ch.totalTokens;
            map.set(s.key, cur);
        }
    }
    const total = [...map.values()].reduce((sum, v) => sum + v.totalTokens, 0);
    return [...map.values()].map(v => ({ ...v, share: pct(v.totalTokens, total) })).sort((a, b) => b.totalTokens - a.totalTokens);
}

/**
 * 组装完整视图
 * @param {object} p
 * @param {string} p.projectId
 * @param {Array} p.ledger 账本记录
 * @param {object} p.assemblies 章号 → { sceneTypes, phase }
 * @param {object} p.wordCounts 章号 → 字数
 */
function buildTokenLedgerView({ projectId, ledger, assemblies = {}, wordCounts = {} }) {
    const byChapter = new Map();
    for (const r of ledger) {
        const ch = r.chapter || 0;
        if (!byChapter.has(ch)) byChapter.set(ch, []);
        byChapter.get(ch).push(r);
    }
    const chapters = [...byChapter.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ch, records]) => buildChapter(ch, records, assemblies[ch], wordCounts[ch]));

    const totalUsage = sumUsage(ledger);
    const totalWords = chapters.reduce((n, c) => n + c.wordCount, 0);
    const allSections = aggregateSections(ledger);
    const groupMap = new Map();
    for (const s of allSections) {
        const cur = groupMap.get(s.group) || { group: s.group, label: slotGroupLabel(s.group), color: s.color, tokens: 0 };
        cur.tokens += s.tokens;
        groupMap.set(s.group, cur);
    }
    const groupTotal = [...groupMap.values()].reduce((sum, v) => sum + v.tokens, 0);

    return {
        projectId,
        hasData: ledger.length > 0,
        generatedAt: new Date().toISOString(),
        totals: {
            chapters: chapters.length,
            calls: ledger.length,
            ...totalUsage,
            cacheHitRate: pct(totalUsage.cachedTokens, totalUsage.promptTokens),
            wordCount: totalWords,
            tokensPerKChar: totalWords > 0 ? Math.round(totalUsage.totalTokens / (totalWords / 1000)) : 0,
            truncatedCount: chapters.reduce((n, c) => n + c.truncatedCount, 0),
            lostTokens: allSections.reduce((n, s) => n + s.lostTokens, 0),
        },
        byStep: aggregateSteps(ledger),
        bySection: allSections,
        byGroup: [...groupMap.values()].map(v => ({ ...v, share: pct(v.tokens, groupTotal) })).sort((a, b) => b.tokens - a.tokens),
        chapters,
        scenes: buildScenes(chapters),
        alerts: buildTokenAlerts(chapters),
        trend: chapters.map(c => ({
            chapter: c.chapter, totalTokens: c.totalTokens, promptTokens: c.promptTokens,
            completionTokens: c.completionTokens, cachedTokens: c.cachedTokens, tokensPerKChar: c.tokensPerKChar,
        })),
    };
}

module.exports = { buildTokenLedgerView, aggregateSections, aggregateSteps, sumUsage };
