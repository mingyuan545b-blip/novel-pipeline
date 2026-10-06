#!/usr/bin/env node
/**
 * backfillScopeOwnership.js — 实体/宠物/仆从/道具的副本归属字段回填（默认干跑）
 *
 * 目的（P2）：为历史数据补齐 `scopeWorldId`，让"归属哪个世界/副本"可查、可门禁。
 * 依据：docs/design/实体中心-副本归属与带出机制.md §三 P2
 *
 * 用法：
 *   node scripts/backfillScopeOwnership.js            # 只扫描（安全）
 *   node scripts/backfillScopeOwnership.js --apply    # 实际写入
 *   node scripts/backfillScopeOwnership.js --json     # 输出 JSON
 *   node scripts/backfillScopeOwnership.js --project <id>
 *
 * 回填规则（保守，不臆造副本）：
 *   - 无 scopeWorldId → 'main-world'（主世界）
 *   - locationSlot / bindMedium 保持原值，不臆造
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AS_JSON = argv.includes('--json');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

const TARGETS = ['entities', 'pets', 'servants', 'materials'];

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');

    const summary = { scanned: 0, missing: 0, updated: 0, byType: {} };
    const planned = [];

    for (const type of TARGETS) {
        let items = await store.queryItems(type, {});
        if (PROJECT) items = items.filter(it => it.projectId === PROJECT);
        summary.byType[type] = { total: items.length, missing: 0 };
        for (const it of items) {
            summary.scanned += 1;
            if (it.scopeWorldId) continue;
            summary.missing += 1;
            summary.byType[type].missing += 1;
            planned.push({ type, id: it.id, name: it.name || '', scopeWorldId: 'main-world' });
        }
    }

    if (APPLY) {
        for (const p of planned) {
            const existing = await store.getItem(p.type, p.id);
            if (!existing) continue;
            await store.setItem(p.type, p.id, {
                ...existing,
                scopeWorldId: existing.scopeWorldId || 'main-world',
                updatedAt: new Date().toISOString()
            });
            summary.updated += 1;
        }
    }

    if (AS_JSON) {
        console.log(JSON.stringify({ apply: APPLY, summary, planned }, null, 2));
    } else {
        console.log(`[scope-backfill] ${APPLY ? '已写入' : '干跑(未写入)'}`);
        console.log(`  扫描 ${summary.scanned} · 缺归属 ${summary.missing} · 写入 ${summary.updated}`);
        for (const [t, s] of Object.entries(summary.byType)) {
            console.log(`  - ${t}: ${s.total} 条，缺归属 ${s.missing}`);
        }
        if (!APPLY && summary.missing > 0) console.log('  提示：加 --apply 生效');
    }
})().catch(err => { console.error('[scope-backfill] 失败:', err.message); process.exit(1); });
