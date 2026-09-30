'use strict';

/**
 * progressView — 运行看板视图组装（纯函数，无 IO，可单测）
 *
 * 回答用户最关心的四个问题（2026-10-01 需求）：
 *   当前跑到第几章 / 现在是哪个 Agent 在干什么 / 这一步用了多久 / 是第几轮
 *
 * 数据来源（全部由调用方注入，本模块只做组装，便于测试）：
 *   - project            → 目标章数/目标字数/项目名
 *   - infiniteStatus     → running / phase / batchProgress / lastError（无限流水线状态）
 *   - chapters           → 已完成章数、字数、状态分布
 *   - logs               → pipeline-logs 文档（entries 含 step/status/round/runRound/timestamp）
 *   - agentTimings       → metrics.agentTimings（每个 Agent 的 calls/avgMs/maxMs/totalTokens）
 *
 * 耗时口径（重要，避免误导）：
 *   - 每一步的耗时 ≈ 该步日志时间戳 − 上一步日志时间戳（日志在步骤**结束时**写入）
 *   - 「当前步骤已进行多久」= now − 最后一条日志时间戳（该步尚未写入日志，故只能用间隔推断）
 *   - Agent 的权威耗时来自 metrics.agentTimings（真实计时），日志推算仅作时间线展示
 *
 * 文件位置：server/services/pipeline/progressView.js
 */
const { AGENT_ROLE_NAMES } = require('../fileOutput');

/** AGENT_ROLE_NAMES 未覆盖的流水线内部步骤 */
const EXTRA_STEP_LABELS = {
    'round-start': '轮次开始',
    outline: '大纲生成',
    'chapter-intent': '章节意图',
};
const STEP_LABELS = Object.assign({}, EXTRA_STEP_LABELS, AGENT_ROLE_NAMES);
const MAX_TIMELINE = 20;

const stepLabel = (step) => STEP_LABELS[step] || (step ? String(step) : '未知步骤');
const toMs = (ts) => { const t = Date.parse(ts); return Number.isFinite(t) ? t : null; };

/** 把各章日志摊平成一条按时间排序的步骤时间线，并算相邻间隔（近似步耗时） */
function buildStepTimeline(logs, nowMs, running) {
    const rows = [];
    for (const doc of (Array.isArray(logs) ? logs : [])) {
        for (const e of ((doc && doc.entries) || [])) {
            const at = toMs(e.timestamp);
            if (at === null) continue;
            rows.push({ raw: e, at });
        }
    }
    rows.sort((a, b) => a.at - b.at);

    const out = [];
    for (let i = 0; i < rows.length; i++) {
        const cur = rows[i];
        const prev = rows[i - 1];
        const e = cur.raw;
        out.push({
            step: e.step || '',
            stepLabel: stepLabel(e.step),
            status: e.status || '',
            passed: e.passed !== undefined ? e.passed : null,
            chapterNumber: e.chapterNumber != null ? e.chapterNumber : null,
            round: e.round != null ? e.round : null,
            runRound: e.runRound != null ? e.runRound : null,
            at: new Date(cur.at).toISOString(),
            durationMs: prev ? Math.max(0, cur.at - prev.at) : null,
        });
    }
    // 正在运行时：最后一步之后还在跑，补一条"进行中"的推断（无日志可依据，仅给已用时长）
    if (running && out.length) {
        const last = out[out.length - 1];
        last.running = true;
        last.elapsedMs = Math.max(0, nowMs - toMs(last.at));
    }
    return out;
}

/** 章节状态分布（中文键在视图层映射，此处只做计数） */
function countChapterStates(chapters) {
    const states = {};
    let words = 0;
    for (const ch of (Array.isArray(chapters) ? chapters : [])) {
        const st = ch.status || 'unknown';
        states[st] = (states[st] || 0) + 1;
        words += ch.wordCount || (ch.content ? ch.content.length : 0);
    }
    return { states, words };
}

/**
 * Agent 耗时统计（来自 metrics.agentTimings）。
 * 排序：先按累计耗时，再按 token 量 —— 实测部分步骤 totalMs 为 0
 * （recordAgentTiming 的 _startTime 缺失导致），此时按 token 排序才有意义；
 * hasTiming 供前端决定展示"耗时"还是"仅 token"。
 */
function buildAgentStats(agentTimings) {
    return Object.entries(agentTimings || {}).map(([agent, m]) => ({
        agent,
        label: stepLabel(agent),
        calls: m.calls || 0,
        avgMs: m.avgMs || 0,
        maxMs: m.maxMs || 0,
        totalMs: m.totalMs || 0,
        totalTokens: m.totalTokens || 0,
        hasTiming: (m.totalMs || 0) > 0,
    })).sort((a, b) => (b.totalMs - a.totalMs) || (b.totalTokens - a.totalTokens));
}

/** 完成度判定：以"素材已更新或已通过"为完成口径（与 stopConditions 一致） */
const DONE_STATUSES = ['material-updated', 'approved'];
function countCompleted(chapters) {
    return (Array.isArray(chapters) ? chapters : [])
        .filter(c => DONE_STATUSES.includes(c.status) && (c.content || '').length > 0).length;
}

/**
 * 组装运行看板视图。
 * @param {object} input { project, infiniteStatus, chapters, logs, agentTimings, now }
 */
function buildProgressView(input) {
    const { project, infiniteStatus, chapters, logs, agentTimings } = input;
    const nowMs = toMs(input.now) || Date.now();
    const status = infiniteStatus || {};
    const running = Boolean(status.running);
    const targetChapters = Number(project && project.targetChapters) || 0;
    const completed = countCompleted(chapters);
    const { states, words } = countChapterStates(chapters);
    const timeline = buildStepTimeline(logs, nowMs, running);

    const last = timeline.length ? timeline[timeline.length - 1] : null;
    const current = last ? {
        step: last.step,
        stepLabel: last.stepLabel,
        chapterNumber: last.chapterNumber,
        round: last.round,
        runRound: last.runRound,
        sinceMs: running ? (last.elapsedMs || 0) : null,
        lastAt: last.at,
    } : null;

    return {
        projectId: (project && project.id) || null,
        projectName: (project && project.name) || '',
        genre: (project && project.genre) || '',
        running,
        phase: status.phase || '',
        batchProgress: status.batchProgress || '',
        lastError: status.lastError || null,
        progress: {
            completed,
            target: targetChapters,
            percent: targetChapters ? Math.min(100, Math.round(completed / targetChapters * 100)) : 0,
            currentChapter: status.currentChapter || (project && project.currentChapter) || null,
            words,
            targetWords: Number(project && project.targetWordCount) || 0,
        },
        current,
        timeline: timeline.slice(-MAX_TIMELINE).reverse(),
        agentStats: buildAgentStats(agentTimings),
        chapterStates: states,
        anomalies: (Array.isArray(status.logs) ? status.logs : [])
            .filter(l => typeof l === 'string' && /失败|错误|超时|⛔|⚠/.test(l)).slice(-10),
        logs: (Array.isArray(status.logs) ? status.logs : []).slice(-30),
    };
}

module.exports = { buildProgressView, buildStepTimeline, buildAgentStats, countCompleted, stepLabel, STEP_LABELS };
