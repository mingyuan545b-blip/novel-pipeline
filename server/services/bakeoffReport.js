'use strict';

/**
 * bakeoffReport.js — 模型对比报告构建（纯函数，支持双盲）
 *
 * 背景：scripts/modelBakeoff.js 原本直接按模型名打印表格 + 落库全文 —— 评判者一眼知道哪个是哪个，
 *   存在"品牌偏置"。本模块把"行格式化 + 双盲去标签"收敛到这里：
 *   - 非盲：label=模型名；
 *   - 盲评：label=匿名代号(A/B/C)，映射(代号→模型)不进入报告，交回调用方单独保存。
 */
const { buildBlindSet } = require('./blindJudge');

/** 元约束命中总数（越低越好）；err/n-a 用字符串表达 */
function summarizeViolations(metrics) {
    const mc = metrics && metrics.metaConstraints;
    if (!mc) return 'n/a';
    if (mc.error) return 'err';
    return String(Object.values(mc).reduce((s, x) => s + (x.violations || 0), 0));
}

function rowFields(r) {
    return {
        chars: r.metrics ? r.metrics.chars : '-',
        violations: summarizeViolations(r.metrics),
        promptTokens: r.usage && r.usage.prompt_tokens != null ? r.usage.prompt_tokens : '-',
        completionTokens: r.usage && r.usage.completion_tokens != null ? r.usage.completion_tokens : '-',
        elapsedMs: r.elapsedMs,
        error: r.error || '',
    };
}

function formatRow(label, f) {
    return [label, f.chars, f.violations, f.promptTokens, f.completionTokens,
        (f.elapsedMs / 1000).toFixed(1), f.error].join(' | ');
}

/** 去掉身份字段（world面向评判者的报告不得含模型名） */
function stripIdentity(r) {
    return { content: r.content, usage: r.usage, elapsedMs: r.elapsedMs, metrics: r.metrics, error: r.error };
}

/**
 * 构建对比报告。
 * @param {Array} results runOneModel 结果数组（含 model 字段）
 * @param {{blind?:boolean, seed?:string}} [opts]
 * @returns {{tableLines:string[], report:{blind:boolean, results:Array}, mapping:Object|null}}
 */
function buildReport(results, opts = {}) {
    const list = Array.isArray(results) ? results : [];
    if (!opts.blind) {
        const lines = ['model | chars | M1-M5 violations | prompt_tokens | completion_tokens | elapsed_s | error'];
        for (const r of list) lines.push(formatRow(r.model, rowFields(r)));
        return { tableLines: lines, report: { blind: false, results: list }, mapping: null };
    }
    const { blinded, mapping } = buildBlindSet(list.map(r => ({ id: r.model, payload: r })), { seed: opts.seed || '' });
    const lines = ['code | chars | M1-M5 violations | prompt_tokens | completion_tokens | elapsed_s | error'];
    const results2 = [];
    for (const b of blinded) {
        lines.push(formatRow(b.code, rowFields(b.payload)));
        results2.push({ code: b.code, ...stripIdentity(b.payload) });
    }
    return { tableLines: lines, report: { blind: true, results: results2 }, mapping };
}

module.exports = { buildReport, summarizeViolations, stripIdentity };
