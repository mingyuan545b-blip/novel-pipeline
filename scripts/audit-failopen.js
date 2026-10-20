#!/usr/bin/env node
/**
 * audit-failopen.js — fail-open（只 log 不处理）审计 + **声明式降级**门禁
 *
 * 背景（R4 / G1）：项目默认姿势是"异常一律 warn 后继续"，日志不落库、不告警、不阻断 → 静默失效。
 * 上一版只做全仓**计数**基线（只许下降），盲区是：新增一处换掉别处一处，计数不变 → 抓不到。
 *
 * 本版口径下沉到**站点**（file:line），并要求新降级**显式声明**：
 *   catch 行或上一行写 `// DEGRADE: 影响=… 可见性=…` 即算已声明。
 *   · 未声明且在基线站点清单内 → WARN（存量，待逐批收敛，不阻断）
 *   · 未声明且**不在**基线清单内 → ERROR（新增必须声明，源头拦截）
 *   · 计数（failOpen / pipelineFailOpen）依旧只许下降
 *
 * 用法：
 *   node scripts/audit-failopen.js            # 计数 + 存量提示（默认，不阻断）
 *   node scripts/audit-failopen.js --strict   # 新增未声明站点即失败（CI/ci:check 用）
 *   node scripts/audit-failopen.js --update-baseline
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { collectSites, siteKey, CATCH_LINE } = require('./lib/failopenSites');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
const BASELINE_FILE = path.join(ROOT, 'docs', 'failopen-baseline.json');

function listJsFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listJsFiles(full, out);
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

function countMatches(re, src) {
    let n = 0;
    for (const line of src.split('\n')) if (re.test(line)) n++;
    return n;
}

function scanCounts() {
    let totalCatch = 0, failOpen = 0, pipelineCatch = 0, pipelineFailOpen = 0;
    for (const f of listJsFiles(SERVER)) {
        const src = fs.readFileSync(f, 'utf8');
        const c = countMatches(CATCH_LINE, src);
        const fo = countMatches(new RegExp(require('./lib/failopenSites').FAILOPEN_RE.source), src);
        totalCatch += c; failOpen += fo;
        if (f.split(path.sep).includes('pipeline')) { pipelineCatch += c; pipelineFailOpen += fo; }
    }
    return { totalCatch, failOpen, pipelineCatch, pipelineFailOpen };
}

function main() {
    const strict = process.argv.includes('--strict');
    const update = process.argv.includes('--update-baseline');
    const counts = scanCounts();
    const sites = collectSites(SERVER);
    const declared = sites.filter((s) => s.declared);
    const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};
    const baselineSites = new Set(baseline.sites || []);
    const hasSiteBaseline = Array.isArray(baseline.sites);

    const newUndeclared = sites.filter((s) => !s.declared && (!hasSiteBaseline || !baselineSites.has(siteKey(s))));
    const legacyUndeclared = sites.filter((s) => !s.declared && hasSiteBaseline && baselineSites.has(siteKey(s)));
    const pipelineSites = sites.filter((s) => s.file.includes('services/pipeline/') || s.file.includes('core/pipeline/'));

    console.log('=== fail-open 审计（声明式降级）===');
    console.log(`站点总数: ${sites.length}（pipeline ${pipelineSites.length}）| 已声明: ${declared.length} | 存量未声明: ${legacyUndeclared.length}`);
    console.log(`计数: failOpen=${counts.failOpen} pipelineFailOpen=${counts.pipelineFailOpen} totalCatch=${counts.totalCatch}`);

    if (update) {
        fs.writeFileSync(BASELINE_FILE, JSON.stringify({
            _comment: 'fail-open 基线：计数只许下降；sites 为已登记站点（未声明的存量，收敛时逐个补 // DEGRADE: 影响=… 可见性=… 后可从清单移除）。',
            measuredAt: new Date().toISOString().slice(0, 10),
            ...counts,
            sites: sites.map(siteKey).sort(),
        }, null, 2) + '\n');
        console.log(`\n已写入基线: ${path.relative(ROOT, BASELINE_FILE)}（站点 ${sites.length}）`);
        return;
    }

    let failed = false;
    for (const key of ['failOpen', 'pipelineFailOpen']) {
        const prev = baseline[key];
        if (typeof prev === 'number' && counts[key] > prev) {
            console.error(`  ❌ [ERROR] ${key} 上升: ${prev} → ${counts[key]}`);
            failed = true;
        } else if (typeof prev === 'number') {
            console.log(`  [OK]   ${key}: ${prev} → ${counts[key]}`);
        }
    }

    const shown = newUndeclared.slice(0, 20);
    for (const s of shown) console.error(`  ❌ [ERROR] 新增 fail-open 未声明: ${siteKey(s)}  ${s.snippet}`);
    if (newUndeclared.length > shown.length) console.error(`  ❌ [ERROR] 另有 ${newUndeclared.length - shown.length} 处新增未声明`);
    if (newUndeclared.length > 0) {
        if (strict) failed = true;
        console.log(`  （新增未声明 ${newUndeclared.length} 处：请在 catch 上加 // DEGRADE: 影响=… 可见性=…，或改真处理）`);
    } else if (declared.length > 0 || hasSiteBaseline) {
        console.log('  [OK]   无新增未声明 fail-open 站点');
    }

    if (legacyUndeclared.length) {
        console.log(`  [WARN] 存量未声明 ${legacyUndeclared.length} 处（待逐批补声明或改真处理；清单见 ${path.relative(ROOT, BASELINE_FILE)}）`);
    }

    if (failed) { console.log('\n❌ fail-open 门禁未通过'); process.exit(1); }
    console.log('\n✅ fail-open 门禁通过（计数未上升，且无新增未声明降级）');
}

main();
