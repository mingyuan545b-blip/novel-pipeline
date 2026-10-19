/**
 * coverageBaseline — 覆盖率棘轮（ratchet）的公共逻辑
 *
 * 背景（E4 / G4）：覆盖率账本曾经只统计 80 个文件的白名单，"91%" 因此名不副实。
 *   口径已改为全量 server，但门槛口径一变，很容易"顺手把阈值调低"从而退回假绿。
 * 做法：把**每个文件的实测水位**落盘为基线（docs/coverage-baseline.json），
 *   门禁断言：任何文件/指标**不得低于基线**（新文件不在基线内 → WARN，需显式 --update 记录）。
 * 与 fail-open 基线（docs/failopen-baseline.json，只许下降）是同一套思路。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

// 容差（实测得出，非拍脑袋）：
//   本项目 jest 多 worker 并行 + 若干用例依赖真实时钟（如 rateLimiter 用 setTimeout/Date.now），
//   同一套测试连续两跑，个别文件的覆盖率会相差最多约 4.4pp（实测 rateLimiter 100% ↔ 95.58%）。
//   因此：聚合指标用 0.5pp（很稳，用于抓整体退化），单文件用 5.0pp（抓"模块丢了测试"这类大幅下降）。
//   已记录的抖动源（属测试质量债，见 worklog E4 节）：tests/unit/rateLimiter*.test.js（时序依赖）。
const EPSILON_PER_FILE = 5.0;
const EPSILON_AGGREGATE = 0.5;

// 粒度补偿：小分母文件的 1 个单元就是很大一个百分点
// （实测 debugPgWriter.js 只有 10 个分支 → 丢 1 个 = 10pp，远超任何固定容差）。
// 因此容差 = EPSILON_PER_FILE + 1 个单元的百分点（100/总数）。单元总数由源码决定，跨运行稳定。
function toleranceFor(units) {
    return EPSILON_PER_FILE + (units > 0 ? 100 / units : 0);
}

/** 每个文件的指标"单元总数"（语句/分支/函数，由源码决定，跨运行稳定） */
function extractUnits(coverageJsonPath) {
    const raw = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
    const out = {};
    for (const [file, data] of Object.entries(raw)) {
        const rel = path.relative(path.join(__dirname, '..', '..'), file).split(path.sep).join('/');
        out[rel] = {
            statements: Object.values(data.s || {}).length,
            branches: Object.values(data.b || {}).flat().length,
            functions: Object.values(data.f || {}).length,
            lines: Object.values(data.s || {}).length,
        };
    }
    return out;
}

/** 从 coverage-final.json（istanbul 原始计数）提取每个文件的四项百分比 */
function extractCoverage(coverageJsonPath) {
    const raw = JSON.parse(fs.readFileSync(coverageJsonPath, 'utf8'));
    const out = {};
    for (const [file, data] of Object.entries(raw)) {
        const rel = path.relative(path.join(__dirname, '..', '..'), file).split(path.sep).join('/');
        const stmts = Object.values(data.s || {});
        const fns = Object.values(data.f || {});
        const brs = Object.values(data.b || {}).flat();
        const linesAll = data.statementMap ? Object.values(data.statementMap).length : 0;
        const linesCovered = stmts.filter((c) => c > 0).length;
        out[rel] = {
            statements: pct(stmts.filter((c) => c > 0).length, stmts.length),
            branches: pct(brs.filter((c) => c > 0).length, brs.length),
            functions: pct(fns.filter((c) => c > 0).length, fns.length),
            lines: pct(linesCovered, linesAll),
        };
    }
    return out;
}

function pct(covered, total) {
    if (!total) return 100;
    return Math.round((covered / total) * 10000) / 100;
}

/** 聚合指标（全量平均），用于"整体退化"判定（比单文件稳定得多） */
function aggregateAll(files) {
    const out = {};
    for (const m of METRICS) {
        const vals = Object.values(files).map((f) => f[m]).filter((v) => typeof v === 'number');
        out[m] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
    }
    return out;
}

/** 基线合并：每个文件/指标取「历史最优」（棘轮只能往上抬） */
function mergeBaseline(existing, current) {
    const merged = { ...existing };
    for (const [file, metrics] of Object.entries(current)) {
        const prev = existing[file];
        if (!prev) { merged[file] = metrics; continue; }
        const next = { ...prev };
        for (const m of METRICS) {
            if (typeof metrics[m] === 'number' && (typeof prev[m] !== 'number' || metrics[m] > prev[m])) next[m] = metrics[m];
        }
        merged[file] = next;
    }
    return merged;
}

/** 对比基线，返回 { regressions:[], improvements:n, unknown:[] }（含容差） */
function diffAgainstBaseline(baseline, current, units) {
    const regressions = [];
    const unknown = [];
    let improvements = 0;
    const unitOf = (file, metric) => (units && units[file] ? units[file][metric] : 0);
    for (const [file, metrics] of Object.entries(current)) {
        const base = baseline[file];
        if (!base) { unknown.push(file); continue; }
        for (const m of METRICS) {
            const b = base[m];
            const c = metrics[m];
            if (typeof b !== 'number') continue;
            const tol = toleranceFor(unitOf(file, m));
            if (b - c > tol) regressions.push(`${file} ${m}: ${b}% → ${c}%（下降 ${(b - c).toFixed(2)}pp，超过容差 ${tol.toFixed(1)}pp）`);
            else if (c > b + 0.01) improvements++;
        }
    }
    return { regressions, improvements, unknown };
}

const DEFAULT_BASELINE = path.join(__dirname, '..', '..', 'docs', 'coverage-baseline.json');

module.exports = {
    METRICS, EPSILON_PER_FILE, EPSILON_AGGREGATE,
    extractCoverage, extractUnits, aggregateAll, mergeBaseline, diffAgainstBaseline, toleranceFor, DEFAULT_BASELINE
};
