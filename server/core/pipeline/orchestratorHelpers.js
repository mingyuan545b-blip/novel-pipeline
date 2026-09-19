const { LLM_DEFAULTS } = require('../../config/systemConfig');
const store = require('../../store');
const { getInfinitePipelineStatus } = require('../../services/pipeline/infinitePipeline');
const logger = require('../../shared/logger');

const MAX_PIPELINE_LOG_ENTRIES = 200;

function checkStopped(projectId, chapterNumber, abortController) {
    try {
        const state = getInfinitePipelineStatus(projectId);
        if (state && state.running && state.stopped) {
            logger.info('pipeline', `Stop signal detected for ch${chapterNumber}`);
            if (abortController && !abortController.signal.aborted) abortController.abort();
            return true;
        }
    } catch (err) {
        logger.warn('pipeline', 'Check stopped error', { error: err.message });
    }
    return false;
}

function getSteps(config) {
    if (config?.flow?.skipSecondReview) return ['writer', 'fast-review', 'final-editor'];
    return ['writer', 'first-review', 'second-review', 'final-editor'];
}

async function clearDownstreamOutputs(chapterId, failedStep) {
    const downstreamMap = {
        'writer': ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'],
        'first-review': ['secondReviewOutput', 'finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'fast-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'second-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
        'final-editor': ['materialManagerOutput', 'polisherOutput']
    };
    const fields = downstreamMap[failedStep] || [];
    if (fields.length === 0) return;
    const ch = await store.getItem('chapters', chapterId);
    if (!ch) return;
    let cleared = false;
    const clearedFields = [];
    for (const f of fields) { if (ch[f]) { clearedFields.push(`${f}=${ch[f].substring(0, 30)}...`); delete ch[f]; cleared = true; } }
    if (cleared) { ch.updatedAt = new Date().toISOString(); await store.setItem('chapters', chapterId, ch); logger.debug('pipeline', `clearDownstreamOutputs: failedStep=${failedStep}, chapterId=${chapterId}, cleared: ${clearedFields.join(', ')}`); }
}

function generateOverrideOutput(overrideReason, stepName, originalFeedback) {
    const origSummary = originalFeedback?.summary || '（无原审核摘要）';
    const origIssues = (originalFeedback?.issues || []).slice(0, 3).map((i, idx) => {
        const desc = typeof i === 'string' ? i : (i.desc || i.description || JSON.stringify(i));
        return `${idx + 1}. ${desc}`;
    }).join('\n');
    return `## ${stepName}结果：✅ 系统覆盖通过\n\n### 覆盖原因\n${overrideReason}\n\n### 原审核意见\n**摘要**：${origSummary}\n${origIssues ? '**主要问题**：\n' + origIssues : ''}\n\n### 覆盖判定依据\n系统判定原审核意见不适用本项目审核标准，自动覆盖为通过。\n\n\`\`\`json\n${JSON.stringify({ passed: true, approved: true, _overridden: true, _overrideReason: overrideReason, summary: `系统覆盖通过：${overrideReason}`, issues: [], suggestions: [], _originalSummary: origSummary }, null, 2)}\n\`\`\``;
}

async function persistPipelineLog(chapterId, projectId, pipelineLog) {
    try {
        const logId = `${chapterId}_pipeline`;
        // 单点补全章节号：pipelineLog各来源条目原本只有step+timestamp，前端执行日志无法定位到章
        // （2026-09-06用户报告）。round由executeStep在入log时打标，此处兜底chapterNumber。
        let chapterNumber;
        try { chapterNumber = (await store.getItem('chapters', chapterId))?.chapterNumber; } catch (_) { /* 非阻塞 */ }
        const entries = pipelineLog.map(e => ({ ...e, timestamp: e.timestamp || new Date().toISOString(), chapterNumber: e.chapterNumber ?? chapterNumber }));
        // 双显示：持久化时也补 runRound（本次运行内的相对轮次 = round - 本log最小round + 1）
        const rounds = entries.map(e => e.round).filter(r => typeof r === 'number');
        const baseRound = rounds.length ? Math.min(...rounds) : 1;
        for (const e of entries) {
            if (e.runRound === undefined && typeof e.round === 'number') e.runRound = Math.max(1, e.round - baseRound + 1);
        }
        const trimmed = entries.length > MAX_PIPELINE_LOG_ENTRIES ? entries.slice(-150) : entries;
        await store.setItem('pipeline-logs', logId, { id: logId, chapterId, projectId, entries: trimmed, updatedAt: new Date().toISOString() });
    } catch (err) { logger.warn('pipeline', 'Failed to persist pipeline log', { error: err.message }); }
}

module.exports = { MAX_PIPELINE_LOG_ENTRIES, checkStopped, getSteps, clearDownstreamOutputs, generateOverrideOutput, persistPipelineLog };

/**
 * 给流水线日志补齐展示元信息：轮次 + 章号。
 * 目的：前端"执行日志"要能显示 第X章 / 第N轮 / 细节，而不是只有 R1/R2。
 * 收尾步骤（material-manager/material-organizer 等）没有轮次 → 归属到刚结束的那一轮。
 */
function tagLogMeta(log, chapterNumber, startRound) {
    if (!Array.isArray(log)) return log;
    let lastRound = startRound || 1;
    for (const entry of log) {
        if (!entry || typeof entry !== 'object') continue;
        if (entry.round === undefined) entry.round = lastRound;
        lastRound = entry.round || lastRound;
        if (entry.chapterNumber === undefined) entry.chapterNumber = chapterNumber;
        // 双显示：round 为跨运行累计轮次，runRound 为本次运行内的第几轮
        if (entry.runRound === undefined && typeof entry.round === 'number') {
            entry.runRound = startRound ? Math.max(1, entry.round - startRound + 1) : entry.round;
        }
    }
    return log;
}

module.exports = { ...module.exports, tagLogMeta };
