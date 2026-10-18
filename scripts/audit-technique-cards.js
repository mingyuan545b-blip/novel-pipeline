#!/usr/bin/env node
/**
 * audit-technique-cards.js — 技法卡「准入标准」体检（B4/F9，只读）
 *
 * 背景（docs/worklog/2026-10-17-假成果审查-问题统计.md F9）：224 条技法中 184 条无
 * `implementation_rules`（空壳）、`judgement_test` 字段全库不存在。
 * 本脚本量化「准入标准」覆盖度：implementation_rules（≥2 条判 full）/ anti_patterns / judgement_test。
 *
 * 数据源：techIndex（PG library_techniques，PG 不可用时自动回落 data/library/*.json 种子）。
 *
 * 用法：
 *   node scripts/audit-technique-cards.js            # 打印覆盖度统计
 *   node scripts/audit-technique-cards.js --json     # 机器可读
 *   node scripts/audit-technique-cards.js --strict   # 未达准入标准则退出码 1（数据补齐后接 CI）
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { assessCompleteness, FULL_RULE_THRESHOLD } = require('../server/services/libraryCompleteness');
const techIndex = require('../server/services/techIndex');

const STRICT = process.argv.includes('--strict');
const AS_JSON = process.argv.includes('--json');

async function main() {
    await techIndex.initFromPg();
    const entries = techIndex.getAll();
    const leaves = entries.map(e => techIndex.getTechnique(e.id)).filter(Boolean);

    let full = 0, partial = 0, empty = 0;
    let rulesOk = 0, antiOk = 0, judgementOk = 0;
    const sourceDist = {};

    for (const t of leaves) {
        const c = assessCompleteness(t);
        if (c.level === 'full') full += 1; else if (c.level === 'partial') partial += 1; else empty += 1;
        if (Array.isArray(t.implementation_rules) && t.implementation_rules.length >= FULL_RULE_THRESHOLD) rulesOk += 1;
        if (Array.isArray(t.anti_patterns) && t.anti_patterns.length > 0) antiOk += 1;
        if (t.judgement_test && (Array.isArray(t.judgement_test) ? t.judgement_test.length > 0 : String(t.judgement_test).trim())) judgementOk += 1;
        const src = t.source || t.origin || '未知';
        sourceDist[src] = (sourceDist[src] || 0) + 1;
    }

    const total = leaves.length;
    const report = {
        source: techIndex.getSource(),
        total,
        implementationRules: { ok: rulesOk, missingRate: total ? +((total - rulesOk) / total).toFixed(3) : 0 },
        antiPatterns: { ok: antiOk, missingRate: total ? +((total - antiOk) / total).toFixed(3) : 0 },
        judgementTest: { ok: judgementOk, coverage: total ? +(judgementOk / total).toFixed(3) : 0 },
        completeness: { full, partial, empty },
        sources: sourceDist,
    };

    if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); }
    else {
        console.log('========================================');
        console.log('技法卡准入标准体检（B4/F9）');
        console.log('========================================');
        console.log('数据源          : ' + report.source + '  技法总数: ' + total);
        console.log('implementation_rules 达标 : ' + rulesOk + '/' + total + '  缺失率 ' + report.implementationRules.missingRate);
        console.log('anti_patterns 覆盖        : ' + antiOk + '/' + total + '  缺失率 ' + report.antiPatterns.missingRate);
        console.log('judgement_test 覆盖       : ' + judgementOk + '/' + total + '  覆盖率 ' + report.judgementTest.coverage);
        console.log('完整度 full/partial/empty : ' + full + ' / ' + partial + ' / ' + empty);
        console.log('来源分布                  : ' + JSON.stringify(sourceDist));
    }

    if (STRICT && (rulesOk < total || judgementOk < total)) {
        console.error('\n❌ 技法卡未达准入标准（需要 implementation_rules 覆盖 100%、judgement_test 覆盖 100%）');
        process.exit(1);
    }
    process.exit(0);
}

main().catch(e => { console.error('[ERROR] ' + e.message); process.exit(2); });
