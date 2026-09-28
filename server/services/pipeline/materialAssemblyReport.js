'use strict';

/**
 * materialAssemblyReport — 装配记账（P1-4c）
 *
 * 单一职责：把"声明要什么"（context.materialNeeds）与"实际拿到什么"（scheduled.materials）
 * 对照，产出三样可被 UI / 门槛 / 体检面板消费的事实：
 *   ① gaps       该有却没有的类别（分级 blocked/warn/info）—— 断档失忆的第一现场；
 *   ② provenance 每个条目的来源 / 素材ID / 最后写入者 / 最后写入章 —— "谁改的、哪一章改的"；
 *   ③ density    每个类别的计划密度 vs 实际密度 + 原因 —— 省 token 与专注力的依据。
 *
 * 全纯函数、无 IO：口径只有一份，便于单测与跨端复用（前端不再自己算）。
 */
const GAP_LEVEL = Object.freeze({ BLOCKED: 'blocked', WARN: 'warn', INFO: 'info' });

/** 缺口原因：按数据源定位，报警时能一眼看出"哪条链断了" */
function gapReason(need) {
    if (need.source === 'entity-center') return 'entity-missing';
    if (need.source === 'knowledge-access') return 'knowledge-empty';
    if (need.source === 'relations') return 'relations-empty';
    return 'material-missing';
}

/**
 * 单类缺口分级
 * - 主动裁剪（dropped）：info，不算故障（省 token 是有意为之）
 * - 声明必须有（required）却一条没拿到：blocked —— 下游只能凭空造，必须报警
 * - 可选类没拿到：warn
 * - 拿到了：无缺口
 */
function gradeGap(need, items) {
    if ((items || []).length > 0) return null;
    if (need.dropped) return { level: GAP_LEVEL.INFO, reason: 'budget-dropped', hint: '预算裁剪主动不注入' };
    if (need.required) return { level: GAP_LEVEL.BLOCKED, reason: gapReason(need), hint: '声明必须有却一条未装载，下游可能凭空生成' };
    return { level: GAP_LEVEL.WARN, reason: gapReason(need), hint: '可选类未装载' };
}

/** 装配前的兜底缺口：连"要什么"都没解析出来，等同该 agent 无数据可用 */
function contextUnresolvedGap() {
    return {
        type: '*', source: 'context', required: true, plannedDepth: null,
        level: GAP_LEVEL.BLOCKED, reason: 'context-unresolved',
        hint: '声明式配置未解析出任何素材需求，该 agent 无素材可用（检查 agentDeclarations / 上下文解析）',
    };
}

function buildGaps(needs, materials) {
    if (needs.length === 0) return [contextUnresolvedGap()];
    const gaps = [];
    for (const need of needs) {
        const gap = gradeGap(need, materials[need.type]);
        if (gap) gaps.push({ type: need.type, source: need.source || 'materials', required: Boolean(need.required), plannedDepth: need.detail || null, ...gap });
    }
    return gaps;
}

/** 来源追溯：每个条目从哪来、素材库里是哪条、最后谁在哪一章改的 */
function buildProvenance(materials) {
    const out = [];
    for (const [type, items] of Object.entries(materials || {})) {
        for (const it of items || []) {
            out.push({
                type, name: it.name || null,
                source: it.source || 'materials',
                depth: it.depth || null,
                materialId: it.materialId || null,
                lastWriter: it.lastWriter || null,
                lastUpdatedChapter: it.lastUpdatedChapter ?? null,
            });
        }
    }
    return out;
}

/** 密度事实：计划深度 vs 实际深度 + 为什么（P1-4d 接入策略表后 reason 会更细） */
function densityReason(need, items) {
    if (need.dropped) return 'budget-dropped';
    if (need.degraded) return 'budget-degraded';
    const actual = items[0]?.depth || null;
    if (need.resolvedDepth && need.detail && actual && need.resolvedDepth !== need.detail) return 'depth-resolved';
    return 'declared';
}

function buildDensity(needs, materials) {
    return needs.map(need => {
        const items = materials[need.type] || [];
        return {
            type: need.type,
            plannedDepth: need.detail || null,
            actualDepth: items[0]?.depth || need.resolvedDepth || null,
            itemCount: items.length,
            chars: items.reduce((sum, it) => sum + (it.content?.length || 0), 0),
            reason: densityReason(need, items),
        };
    });
}

/**
 * 装配报告
 * @param {{context: object, scheduled: object}} params
 * @returns {{gaps: Array, provenance: Array, density: Array, summary: object}}
 */
function buildAssemblyReport({ context, scheduled }) {
    const needs = (context && context.materialNeeds) || [];
    const materials = (scheduled && scheduled.materials) || {};
    const gaps = buildGaps(needs, materials);
    const provenance = buildProvenance(materials);
    const blocked = gaps.filter(g => g.level === GAP_LEVEL.BLOCKED);
    return {
        gaps, provenance, density: buildDensity(needs, materials),
        summary: {
            typesPlanned: needs.length,
            gapBlocked: blocked.length,
            gapWarn: gaps.filter(g => g.level === GAP_LEVEL.WARN).length,
            gapInfo: gaps.filter(g => g.level === GAP_LEVEL.INFO).length,
            blockedTypes: blocked.map(g => g.type),
            provenanceCount: provenance.length,
            untracedCount: provenance.filter(p => p.source === 'entity-center' && !p.lastWriter).length,
        },
    };
}

module.exports = { buildAssemblyReport, buildGaps, buildProvenance, buildDensity, gradeGap, gapReason, GAP_LEVEL };
