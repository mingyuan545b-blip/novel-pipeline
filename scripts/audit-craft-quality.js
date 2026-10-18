#!/usr/bin/env node
/**
 * audit-craft-quality.js — 实体工艺字段质量闸门（只读）
 *
 * 背景（2026-10-17 取证）：`craftQualitySpec` 写了"什么是高光/名言/魅力"，但设计期解析与素材管理员
 * 增量能绕过校验直写实体，库里存在「处境混入 quote / 标签式 why / 剧情摘要式 what / 裸字符串口头禅」。
 * 本脚本用同一套校验器（validateQuotes/validateHighlights/validateCatchphrases + 魅力句式）扫真实库，
 * 作为**存量体检**与**回归闸门**（--strict 接 CI）。
 *
 * 用法：
 *   node scripts/audit-craft-quality.js                 # 扫库里全部角色实体，打印违规统计
 *   node scripts/audit-craft-quality.js --samples 5     # 每类最多打印 5 条样例
 *   node scripts/audit-craft-quality.js --strict        # 有违规则退出码 1（接 CI）
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const { Pool } = require('pg');

const { validateQuotes } = require('../server/services/validateQuotes');
const { validateHighlights } = require('../server/services/validateHighlights');
const { validateCatchphrases } = require('../server/services/validateCatchphrases');

const STRICT = process.argv.includes('--strict');
const SAMPLES = Number((process.argv.find((a) => a.startsWith('--samples=')) || '').split('=')[1]) || 3;
const CHARISMA_FORM_RE = /宁可|也不|宁愿/;

const ARRAY_FIELDS = [
    { field: 'quoteLibrary', label: '金句库', validate: validateQuotes },
    { field: 'highlightScenes', label: '高光场景', validate: validateHighlights },
    { field: 'catchphrases', label: '口头禅', validate: validateCatchphrases },
];

/** 检查单个实体，返回违规列表 [{ field, reason, sample }] */
function inspectEntity(data) {
    const out = [];
    for (const { field, label, validate } of ARRAY_FIELDS) {
        const arr = data[field];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const { passed, failed } = validate(arr);
        if (passed < arr.length) {
            const bad = failed[0];
            out.push({ field, reason: `${label}: ${passed}/${arr.length} 合格`, sample: bad ? (bad.issues || []).join('；') : '' });
        }
    }
    const charisma = String(data.charisma || '').trim();
    if (charisma && !CHARISMA_FORM_RE.test(charisma)) {
        out.push({ field: 'charisma', reason: '人格魅力未写成"当X时，他宁可Y，也不Z"', sample: charisma.slice(0, 40) });
    }
    return out;
}

(async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const { rows } = await pool.query(
            "SELECT projectid, name, data FROM entities WHERE data::text LIKE '%quoteLibrary%' OR data::text LIKE '%highlightScenes%'"
        );
        const byProject = {};
        const samples = [];
        let entities = 0, violated = 0, violations = 0;
        for (const r of rows) {
            let data; try { data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; } catch { continue; }
            entities++;
            const bad = inspectEntity(data);
            if (bad.length === 0) continue;
            violated++; violations += bad.length;
            const p = r.projectid.slice(0, 8);
            byProject[p] = (byProject[p] || 0) + bad.length;
            if (samples.length < SAMPLES * 3) samples.push({ project: p, name: r.name, ...bad[0] });
        }
        console.log(`\n工艺字段体检：角色实体 ${entities} 个，其中 ${violated} 个含违规，共 ${violations} 处。`);
        console.log('按项目：', Object.entries(byProject).map(([k, v]) => `${k}=${v}`).join('  ') || '（无）');
        console.log('\n样例：');
        samples.slice(0, SAMPLES * 3).forEach((s) => console.log(`  [${s.project}] ${s.name} · ${s.reason}\n      → ${s.sample}`));
        if (STRICT && violations > 0) process.exitCode = 1;
    } catch (e) {
        console.error('扫描失败：', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
