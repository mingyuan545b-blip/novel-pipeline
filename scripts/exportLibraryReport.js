#!/usr/bin/env node
/**
 * exportLibraryReport.js — 导出藏经阁技法库为可读报告（txt/md）
 *
 * 用途：把PG里的技法导成人类可读文档（交付/复盘/给写作AI当参考手册）。
 *
 * 用法：
 *   node scripts/exportLibraryReport.js                       # 全部技法 → output/library-report.txt
 *   node scripts/exportLibraryReport.js --with-rules           # 只导出有实施规则的（去掉空壳条目）
 *   node scripts/exportLibraryReport.js --source 全球死考        # 只导出某作品提取的
 *   node scripts/exportLibraryReport.js --out D:\x\report.txt  # 指定输出路径
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const onlyWithRules = argv.includes('--with-rules');
const srcIdx = argv.indexOf('--source');
const sourceFilter = srcIdx >= 0 ? argv[srcIdx + 1] : null;
const outIdx = argv.indexOf('--out');
const OUT = outIdx >= 0 ? argv[outIdx + 1] : path.join(__dirname, '..', 'output', 'library-report.txt');

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const { initDatabaseAsync } = require('../server/db/database-pg');
    await initDatabaseAsync();
    const libraryStore = require('../server/services/libraryStore');

    let all = await libraryStore.listTechniques();
    const totalBefore = all.length;
    if (onlyWithRules) all = all.filter(t => (t.implementation_rules || []).length > 0);
    if (sourceFilter) all = all.filter(t => (t.source_novel || '').includes(sourceFilter));

    const byDept = {};
    for (const t of all) {
        byDept[t.department] = byDept[t.department] || {};
        (byDept[t.department][t.subcategory] = byDept[t.department][t.subcategory] || []).push(t);
    }

    const L = [];
    L.push('='.repeat(88));
    L.push('藏经阁 · 写作技法库报告');
    L.push('='.repeat(88));
    L.push(`导出时间：${new Date().toISOString()}`);
    L.push(`技法总数：${totalBefore}${onlyWithRules ? `（其中有实施规则 ${all.length} 条，本报告只含这部分）` : ''}`);
    if (sourceFilter) L.push(`筛选来源：${sourceFilter}（${all.length} 条）`);
    L.push('');
    L.push('说明：技法按「部门 / 子类」组织。每条包含：定义、可执行规则、反模式（抄错的样子）。');
    L.push('     部门=写作能力域，子类=该域下的具体切口，注入点=这条技法会被送进哪个Agent的prompt。');
    L.push('');

    for (const dept of Object.keys(byDept).sort()) {
        L.push('');
        L.push('#'.repeat(2) + ' ' + dept.replace(/^\d+_/, ''));
        for (const sub of Object.keys(byDept[dept]).sort()) {
            L.push('');
            L.push(`  ── ${sub.replace(/^\d+_/, '')} ──`);
            for (const t of byDept[dept][sub]) {
                L.push('');
                L.push(`  【${t.display_name}】`);
                L.push(`    注入点：${t.injection_point}　槽位：${t.context_slot}　深度：${t.worldviewDepth}　字数影响：${t.word_count_impact}`);
                if (t.source_novel) L.push(`    来源：${t.source_novel}（${t.source_type}）`);
                if (t.description) L.push(`    定义：${t.description}`);
                if ((t.implementation_rules || []).length) {
                    L.push('    规则：');
                    t.implementation_rules.forEach((r, i) => L.push(`      ${i + 1}. ${r}`));
                }
                if ((t.anti_patterns || []).length) {
                    L.push('    反模式：');
                    t.anti_patterns.forEach(a => L.push(`      × ${a}`));
                }
                if ((t.evidence || []).length) {
                    L.push(`    例证：${t.evidence.join(' ｜ ')}`);
                }
            }
        }
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, L.join('\n'), 'utf-8');
    console.log(`报告已导出：${OUT}（${all.length}/${totalBefore} 条技法，${L.length} 行）`);
    process.exit(0);
})().catch(e => { console.error('导出失败:', e.message); process.exit(1); });
