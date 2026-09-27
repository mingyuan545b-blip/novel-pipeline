'use strict';

/**
 * tokenLedger.js — Token 消耗账本（每章 × 每步 × 每次调用一条）
 *
 * 目的：回答"token 都去哪了、哪一步/哪一段吃掉了、哪里被截断"。
 * 数据来源：agentRunner 单点上报（result.usage + budget.getReport()）。
 * 存储：独立 kv 集合 token-ledger，键 = `${projectId}_ch0006_writer_r1_<seq>`。
 *
 * 为什么按"每次调用"一条、而不是内嵌数组：
 *   内嵌需要"读整条→改→整体写回"，无限流水线并发跑多章时会丢失更新
 *   （contextTrace 已有同样的实测教训，见其 recordAssembly 注释）。
 *
 * 文件位置：server/services/pipeline/tokenLedger.js
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { getRunContext } = require('../../shared/runContext');

const LEDGER_STORE = 'token-ledger';

const chapterKey = (n) => `chapter-${String(n || 0).padStart(4, '0')}`;

/** 归一化 LLM usage（含缓存命中，缓存 token 通常单价极低） */
function normalizeUsage(usage) {
    return {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        cachedTokens: usage?.prompt_tokens_details?.cached_tokens || 0,
    };
}

/** 从 budget.getReport() 提取各提示词分段占用（含截断/丢失量） */
function extractPromptSections(report) {
    if (!report || !report.slots) return [];
    return Object.entries(report.slots)
        .map(([slot, v]) => {
            const tokens = v.tokens || 0;
            const originalTokens = v.originalTokens != null ? v.originalTokens : tokens;
            return {
                slot,
                tokens,
                maxTokens: v.maxTokens || 0,
                originalTokens,
                lostTokens: Math.max(0, originalTokens - tokens),
                wasTruncated: Boolean(v.wasTruncated),
            };
        })
        .filter(s => s.tokens > 0 || s.wasTruncated)
        .sort((a, b) => b.tokens - a.tokens);
}

/** 记录一次 LLM 调用的 token 去向（失败不阻断主流程） */
async function recordTokenLedger({ projectId, chapterNumber, step, model, usage, contextReport, outputChars }) {
    if (!projectId || !step) return null;
    try {
        const ctx = getRunContext() || {};
        const round = ctx.round || null;
        const runRound = (ctx.startRound && round) ? Math.max(1, round - ctx.startRound + 1) : (round || null);
        const sections = extractPromptSections(contextReport);
        const id = `${projectId}_${chapterKey(chapterNumber)}_${step}_r${round || 1}_${Date.now().toString(36)}`;
        const record = {
            id,
            projectId,
            chapter: chapterNumber || 0,
            chapterKey: chapterKey(chapterNumber),
            step,
            round,
            runRound,
            model: model || null,
            usage: normalizeUsage(usage),
            promptSections: sections,
            truncatedSlots: sections
                .filter(s => s.wasTruncated)
                .map(s => ({ slot: s.slot, tokens: s.tokens, originalTokens: s.originalTokens, lostTokens: s.lostTokens })),
            budget: contextReport ? {
                totalBudget: contextReport.totalBudget || 0,
                inputBudget: contextReport.inputBudget || 0,
                outputReserve: contextReport.outputReserve || 0,
                allocated: contextReport.allocated || 0,
                utilization: contextReport.utilization || null,
            } : null,
            outputChars: outputChars || 0,
            recordedAt: new Date().toISOString(),
        };
        await store.setItem(LEDGER_STORE, id, record);
        return record;
    } catch (e) {
        logger.warn('tokenLedger', `record failed: ${e.message}`);
        return null;
    }
}

/** 项目全部账本（按章、时间升序） */
async function getProjectLedger(projectId) {
    const rows = await store.queryItems(LEDGER_STORE, { projectId });
    return rows.sort((a, b) => (a.chapter || 0) - (b.chapter || 0) ||
        String(a.recordedAt).localeCompare(String(b.recordedAt)));
}

/** 单章账本 */
async function getChapterLedger(projectId, chapterNumber) {
    const rows = await getProjectLedger(projectId);
    return rows.filter(r => (r.chapter || 0) === chapterNumber);
}

/** 滚动淘汰过老的账本（控制无限流水线下的存储增长） */
async function pruneOldLedger(projectId, currentChapter, keepChapters = 200) {
    const minKeep = currentChapter - keepChapters;
    if (currentChapter % 20 !== 0 || minKeep <= 0) return 0;
    const rows = await getProjectLedger(projectId);
    let removed = 0;
    for (const r of rows) {
        if ((r.chapter || 0) > 0 && (r.chapter || 0) < minKeep) {
            try { await store.deleteItem(LEDGER_STORE, r.id); removed++; } catch { /* 忽略单条删除失败 */ }
        }
    }
    if (removed) logger.info('tokenLedger', `pruned ${removed} old records (project=${projectId})`);
    return removed;
}

module.exports = {
    LEDGER_STORE, chapterKey,
    normalizeUsage, extractPromptSections,
    recordTokenLedger, getProjectLedger, getChapterLedger, pruneOldLedger,
};
