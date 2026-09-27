#!/usr/bin/env node
/**
 * migrateMaterialLifecycle.js — 素材生命周期字段回填（默认干跑）
 *
 * 目的（P0-2）：为素材补齐 `state`，让"归档/报废"与"章节区间"可被加载链识别，
 * 避免报废素材继续进入后续章节上下文（token 黑洞）。
 *
 * 用法：
 *   node scripts/migrateMaterialLifecycle.js            # 只扫描（安全）
 *   node scripts/migrateMaterialLifecycle.js --apply    # 实际写入
 *   node scripts/migrateMaterialLifecycle.js --json     # 输出 JSON
 *
 * 回填规则（保守，不臆造区间）：
 *   - archived===true        → state='retired'
 *   - 无 state 且未归档      → state='active'
 *   - activeFromChapter/activeToChapter 不动（由人工/后续 UI 指定）
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AS_JSON = argv.includes('--json');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');

    let materials = await store.queryItems('materials', {});
    if (PROJECT) materials = materials.filter(m => m.projectId === PROJECT);
    const summary = { total: materials.length, archived: 0, missingState: 0, withRange: 0, updated: 0, byType: {} };
    const toUpdate = [];

    for (const m of materials) {
        const type = m.type || 'other';
        summary.byType[type] = summary.byType[type] || { total: 0, archived: 0 };
        summary.byType[type].total += 1;
        if (m.archived) { summary.archived += 1; summary.byType[type].archived += 1; }
        if (!m.state) summary.missingState += 1;
        if (m.activeFromChapter || m.activeToChapter) summary.withRange += 1;

        const want = m.archived ? 'retired' : 'active';
        if (m.state !== want) toUpdate.push({ id: m.id, name: m.name, from: m.state || '(无)', to: want });
    }

    if (APPLY) {
        for (const u of toUpdate) {
            const m = await store.getItem('materials', u.id);
            if (!m) continue;
            await store.setItem('materials', u.id, { ...m, state: u.to, updatedAt: new Date().toISOString() });
            summary.updated += 1;
        }
    }

    if (AS_JSON) { console.log(JSON.stringify({ summary, pending: toUpdate.length, sample: toUpdate.slice(0, 10) }, null, 2)); return; }

    console.log(`=== 素材生命周期回填（${APPLY ? '写入' : '干跑'}）===`);
    console.log(`素材总数 ${summary.total} · 已归档 ${summary.archived} · 缺 state ${summary.missingState} · 有区间 ${summary.withRange}`);
    console.log('按类型：');
    for (const [t, v] of Object.entries(summary.byType).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  ${t.padEnd(16)} ${v.total}（归档 ${v.archived}）`);
    }
    console.log(`\n待回填 ${toUpdate.length} 条：`);
    toUpdate.slice(0, 12).forEach(u => console.log(`  ${String(u.name).slice(0, 24)} : ${u.from} → ${u.to}`));
    if (!APPLY && toUpdate.length) console.log('\n（干跑，未写入；加 --apply 生效）');
    if (APPLY) console.log(`\n✅ 已写入 ${summary.updated} 条`);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
