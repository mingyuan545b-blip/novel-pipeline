'use strict';

/**
 * contextAssemblyRecorder.js — 上下文装配实况记录器
 *
 * 职责：把"这一章这个Agent到底装载了哪些提示词/资料、什么深度、多少字符、
 *      哪些被判定不需要、哪些该有却没有（数据丢失）"落盘成一条装配记录。
 *
 * 数据来源：contextCommander 的决策结果（materialNeeds/decisionLog）+ 调度器实际装载结果。
 * 存储：project.contextTraces.chapters[ch].assemblies[agentType]（沿用既有存储，不新增表）
 */
const { estimateTokens } = require('../contextBudget');
const { getContextTraceForProject } = require('../contextTrace');
const { ASSEMBLY_TRACE_POLICY } = require('../../config/assemblyTracePolicy');
const logger = require('../../shared/logger');

const TYPE_STATUS = Object.freeze({
    INJECTED: 'injected',
    DROPPED: 'dropped',
    EMPTY: 'empty',
    MISSING: 'missing',
});

/** 单个素材类型的装配明细 */
function _buildTypeEntry(need, items, density) {
    const chars = items.reduce((sum, it) => sum + (it.content?.length || 0), 0);
    let status;
    if (need.dropped) status = TYPE_STATUS.DROPPED;
    else if (items.length > 0) status = TYPE_STATUS.INJECTED;
    else status = TYPE_STATUS.EMPTY;
    return {
        type: need.type,
        status,
        relevanceReason: need.relevanceReason || null,
        dropReason: need.dropReason || null,
        plannedDepth: need.detail || null,
        actualDepth: need.resolvedDepth || null,
        // P1-4c/P1-4d 密度事实：实际注入的深度与原因（省 token 与专注力的依据）
        densityReason: density?.reason || null,
        injectedDepth: density?.actualDepth || null,
        degraded: Boolean(need.degraded),
        itemCount: items.length,
        chars,
        estTokens: estimateTokens(items.map(it => it.content || '').join('')),
    };
}

/**
 * 从调度结果构建装配记录
 * @returns {object} assembly
 */
function buildAssembly({ agentType, chapterNumber, context, scheduled, report }) {
    const needs = context.materialNeeds || [];
    const materials = scheduled?.materials || {};
    const densityByType = new Map((report?.density || []).map(d => [d.type, d]));
    const types = needs.map(need => _buildTypeEntry(need, materials[need.type] || [], densityByType.get(need.type)));

    const actualChars = types.reduce((sum, t) => sum + t.chars, 0);
    const injected = types.filter(t => t.status === TYPE_STATUS.INJECTED);
    const dropped = types.filter(t => t.status === TYPE_STATUS.DROPPED);
    const empty = types.filter(t => t.status === TYPE_STATUS.EMPTY);
    const missing = types.filter(t => t.status === TYPE_STATUS.MISSING);

    return {
        agentType,
        chapterNumber,
        budget: {
            level: context.budgetAssessment?.status?.level || null,
            label: context.budgetAssessment?.status?.label || null,
            action: context.budgetAssessment?.status?.action || null,
            ratio: context.budgetAssessment?.ratio ?? null,
            charBudget: context.budgetAssessment?.charBudget ?? null,
            plannedChars: context.budgetAssessment?.plannedChars ?? null,
            tokenCeiling: context.budgetAssessment?.tokenCeiling ?? null,
        },
        meta: context.meta || null,
        constraintsChars: scheduled?.constraints?.text?.length || 0,
        summary: {
            plannedTypes: needs.length,
            injectedTypes: injected.length,
            droppedTypes: dropped.length,
            emptyTypes: empty.length,
            missingTypes: missing.length,
            gapBlocked: report?.summary?.gapBlocked ?? 0,
            gapWarn: report?.summary?.gapWarn ?? 0,
            gapInfo: report?.summary?.gapInfo ?? 0,
            provenanceCount: report?.summary?.provenanceCount ?? 0,
            actualChars,
            estTokens: estimateTokens(types.map(t => t.type).join('')) + injected.reduce((s, t) => s + t.estTokens, 0),
        },
        sources: buildSourceFlow(context, scheduled),
        // P1-4c 记账三件：缺口（该有没有）/ 来源追溯（谁写在哪章）/ 密度事实（为什么这个深度）
        gaps: report?.gaps || [],
        provenance: report?.provenance || [],
        density: report?.density || [],
        types,
    };
}

/** 数据源流通状态：素材库/实体中心/知识库/意图/约束/时间轴/技法/记忆 */
function buildSourceFlow(context, scheduled) {
    const stats = scheduled?.stats || {};
    const hasEntityItems = (context.materialNeeds || []).some(n => n.source === 'entity-center' && !n.dropped);
    const hasKnowledge = (context.materialNeeds || []).some(n => n.type === 'knowledge-access' && !n.dropped);
    return [
        { key: 'materials', label: '素材库', wired: true, detail: `装载${stats.loaded ?? 0}条 / ${stats.actualChars ?? 0}字` },
        { key: 'entity-center', label: '实体中心', wired: hasEntityItems, detail: hasEntityItems ? '已请求实体缓存' : '本章未请求' },
        { key: 'knowledge-base', label: '知识库', wired: hasKnowledge, detail: hasKnowledge ? '已请求知识访问' : '本章未请求' },
        { key: 'intent', label: '章节意图', wired: Boolean(context.intentResult?.intent), detail: context.intentResult?.intent ? '意图已接入决策' : '无意图（未规划或读取失败）' },
        { key: 'constraints', label: '约束规则', wired: Boolean(scheduled?.constraints?.text), detail: `${scheduled?.constraints?.text?.length || 0}字` },
        { key: 'relations', label: '人物关系', wired: (context.materialNeeds || []).some(n => n.type === 'relationship' && !n.dropped), detail: ((context.materialNeeds || []).some(n => n.type === 'relationship' && !n.dropped)) ? '已请求关系表' : '本章未请求' },
        { key: 'memory', label: '记忆(事实+叙事)', wired: true, detail: '由提示词装配注入（memory-pyramid + 卷摘要）' },
        { key: 'budget', label: '预算规划', wired: Boolean(context.budgetAssessment), detail: `${context.budgetAssessment?.status?.label || '-'} (${context.budgetAssessment?.status?.level || '-'})` },
    ];
}

/** 是否需要为该Agent记录装配实况 */
function shouldRecord(agentType) {
    return ASSEMBLY_TRACE_POLICY.agents.includes(agentType);
}

/** 记录（失败不阻断主流程；非关键Agent直接跳过） */
async function recordAssembly(params) {
    if (!shouldRecord(params.agentType)) return null;
    try {
        const assembly = buildAssembly(params);
        const trace = getContextTraceForProject(params.projectId);
        await trace.recordAssembly(params.chapterNumber, assembly);
        await pruneOldAssemblies(trace, params.chapterNumber);
        return assembly;
    } catch (e) {
        logger.warn('contextAssemblyRecorder', `record failed: ${e.message}`);
        return null;
    }
}

/** 滚动淘汰过老的装配记录，控制项目记录体积（按 pruneEveryChapters 节流） */
async function pruneOldAssemblies(trace, currentChapter) {
    if (currentChapter % ASSEMBLY_TRACE_POLICY.pruneEveryChapters !== 0) return;
    const minKeep = currentChapter - ASSEMBLY_TRACE_POLICY.maxChapters;
    if (minKeep <= 0) return;
    const all = await trace.getAllTraces();
    const stale = Object.keys(all).filter(key => {
        const ch = Number(key.replace('chapter-', ''));
        return ch > 0 && ch < minKeep;
    });
    if (stale.length === 0) return;
    await trace.dropChapters(stale);
}

module.exports = { recordAssembly, buildAssembly, buildSourceFlow, shouldRecord, TYPE_STATUS };
