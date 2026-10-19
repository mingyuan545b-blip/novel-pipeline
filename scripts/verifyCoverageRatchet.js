#!/usr/bin/env node
/**
 * verifyCoverageRatchet.js — 覆盖率棘轮门禁（每个文件只升不降）
 *
 * 背景（E4/G4）：覆盖率口径曾只统计 80 文件白名单，且阈值可被"顺手调低" → 假绿容易复发。
 * 本门禁把每个文件的实测水位落盘为基线（docs/coverage-baseline.json），断言语义与
 * fail-open 基线一致：**任何下降都报错**。
 *
 * 用法：
 *   node scripts/verifyCoverageRatchet.js            # 与基线比对（CI/pre-push 用）
 *   node scripts/verifyCoverageRatchet.js --update   # 记录/刷新基线（人工确认后执行）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
    extractCoverage, extractUnits, aggregateAll, mergeBaseline, diffAgainstBaseline,
    EPSILON_PER_FILE, EPSILON_AGGREGATE, DEFAULT_BASELINE
} = require('./lib/coverageBaseline');

const ROOT = path.join(__dirname, '..');
const COVERAGE_JSON = path.join(ROOT, 'coverage', 'coverage-final.json');
const { METRICS: METRIC_KEYS } = require('./lib/coverageBaseline');
const UPDATE = process.argv.includes('--update');

function main() {
    console.log('========================================');
    console.log('覆盖率棘轮（每文件只升不降）');
    console.log('========================================');
    if (!fs.existsSync(COVERAGE_JSON)) {
        console.error(`  ❌ [ERROR] 未找到 ${path.relative(ROOT, COVERAGE_JSON)} — 请先跑 npm run coverage:check`);
        process.exit(1);
    }
    const current = extractCoverage(COVERAGE_JSON);
    const fileCount = Object.keys(current).length;

    if (UPDATE) {
        const existing = fs.existsSync(DEFAULT_BASELINE)
            ? (JSON.parse(fs.readFileSync(DEFAULT_BASELINE, 'utf8')).files || {})
            : {};
        // 取"历史最优"：棘轮只能往上抬，避免把一次抖动偏低的值固化成新地板
        const files = mergeBaseline(existing, current);
        const payload = {
            _note: '覆盖率棘轮基线：每文件四项指标的实测水位（取历史最优）。只许上升；'
                + `下降超过单文件容差 ${EPSILON_PER_FILE}pp 会被 scripts/verifyCoverageRatchet.js 拦下。`,
            _updatedAt: new Date().toISOString().slice(0, 10),
            _aggregate: aggregateAll(files),
            files,
        };
        fs.writeFileSync(DEFAULT_BASELINE, JSON.stringify(payload, null, 2) + '\n');
        console.log(`  ✅ 已写入基线：${path.relative(ROOT, DEFAULT_BASELINE)}（${fileCount} 个文件）`);
        return;
    }

    if (!fs.existsSync(DEFAULT_BASELINE)) {
        console.error(`  ❌ [ERROR] 缺少基线文件 ${path.relative(ROOT, DEFAULT_BASELINE)} — 首次请执行 --update 并提交`);
        process.exit(1);
    }
    const parsed = JSON.parse(fs.readFileSync(DEFAULT_BASELINE, 'utf8'));
    const baseline = parsed.files || parsed;

    const units = extractUnits(COVERAGE_JSON);
    const { regressions, improvements, unknown } = diffAgainstBaseline(baseline, current, units);

    // 聚合指标：容差最小，用于抓"整体退化"（单文件会受并行调度抖动影响，故放宽）
    const aggBase = parsed._aggregate || aggregateAll(baseline);
    const aggCur = aggregateAll(current);
    const aggDrops = [];
    for (const m of Object.keys(aggCur)) {
        if (aggBase[m] - aggCur[m] > EPSILON_AGGREGATE) {
            aggDrops.push(`全量 ${m}: ${aggBase[m]}% → ${aggCur[m]}%（下降 ${(aggBase[m] - aggCur[m]).toFixed(2)}pp）`);
        }
    }
    console.log(`  基线文件数: ${Object.keys(baseline).length}，本次覆盖文件数: ${fileCount}`);
    console.log(`  聚合水位（基线 → 本次）: ${METRIC_KEYS.map((m) => `${m} ${aggBase[m]}%→${aggCur[m]}%`).join(' / ')}`);
    if (improvements) console.log(`  ✅ 有 ${improvements} 项指标高于基线（允许）`);
    for (const u of unknown.slice(0, 20)) console.warn(`  ⚠️  [WARN] 新文件未入基线（需 --update 记录）: ${u}`);
    if (unknown.length > 20) console.warn(`  ⚠️  [WARN] 另有 ${unknown.length - 20} 个新文件未入基线`);
    if (regressions.length) {
        for (const r of regressions.slice(0, 30)) console.error(`  ❌ [ERROR] 覆盖率下降: ${r}`);
        if (regressions.length > 30) console.error(`  ❌ [ERROR] 另有 ${regressions.length - 30} 处下降`);
        console.log(`\n校验完成: ${regressions.length} 处下降`);
        process.exit(1);
    }
    console.log(`\n校验完成: 0 处下降（${unknown.length} 个新文件待记录）`);
    console.log('✅ 覆盖率无退化');
}

main();
