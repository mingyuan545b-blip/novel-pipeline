#!/usr/bin/env node
/**
 * backfillProjectSpend.js — 从 token 账本回填「项目累计消耗」（project-spend）
 *
 * 背景：project-spend 是 2026-09-30 新增的预算熔断数据源，只从上线那一刻开始累计。
 *   历史项目在此之前花掉的 tokens 不会自动进入统计，导致预算面板对老项目显示 0。
 *   本脚本按项目聚合 token-ledger（每调用一条的明细账）补出累计值。
 *
 * 局限（务必知道）：token-ledger 会被 pruneOldLedger 按"保留 200 章"裁剪，
 *   因此**超过 200 章的老项目回填值会偏低**。这是一次性补偿，
 *   回填后新产生的消耗由 agentRunner 实时累加，不再依赖账本。
 *
 * 用法：
 *   node scripts/backfillProjectSpend.js                    # 干跑（默认，只报告不写）
 *   node scripts/backfillProjectSpend.js --apply            # 实际写入
 *   node scripts/backfillProjectSpend.js --apply --project <id>   # 只处理指定项目
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const onlyIdx = argv.indexOf('--project');
const ONLY_PROJECT = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

(async () => {
    const { initPgPool, closePgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);

    const store = require('../server/store');
    const tokenLedger = require('../server/services/pipeline/tokenLedger');
    const pb = require('../server/services/pipeline/projectBudget');

    const rows = await store.queryItems('token-ledger', {});
    console.log('账本明细 ' + rows.length + ' 条' + (APPLY ? '' : '（干跑）'));

    const byProject = {};
    for (const r of rows) {
        if (!r || !r.projectId) continue;
        if (ONLY_PROJECT && r.projectId !== ONLY_PROJECT) continue;
        const b = byProject[r.projectId] || (byProject[r.projectId] = { tokens: 0, calls: 0, chapters: new Set() });
        b.tokens += Number(r.usage && r.usage.totalTokens) || 0;
        b.calls += 1;
        if (r.chapter) b.chapters.add(r.chapter);
    }

    const ids = Object.keys(byProject);
    if (!ids.length) { console.log('没有可回填的项目'); await closePgPool(); return; }

    let written = 0, skippedOrphan = 0;
    for (const pid of ids) {
        const b = byProject[pid];
        // 只为仍存在的项目建账，否则会凭空造出新的孤儿数据（scanOrphans 会报）
        const project = await store.getItem('projects', pid);
        if (!project) { skippedOrphan++; continue; }
        const existing = await pb.getSpend(pid);
        console.log('');
        console.log(pid + '  账本 ' + b.tokens + ' tokens / ' + b.calls + ' 次调用 / ' + b.chapters.size + ' 章');
        console.log('  现有累计: ' + existing.tokens + ' tokens（调用 ' + existing.calls + '）');
        if (existing.tokens >= b.tokens) { console.log('  跳过：现有累计不低于账本聚合值'); continue; }
        if (!APPLY) { console.log('  待写入: ' + b.tokens + ' tokens（干跑，未写）'); continue; }
        // 直接覆写为账本聚合值（账本更精确；此后由 agentRunner 实时累加）
        await store.setItem(pb.SPEND_STORE, pid, {
            id: pid, projectId: pid,
            tokens: b.tokens, promptTokens: 0, completionTokens: 0,
            costCny: pb.estimateCostCny('qwen3.8-flash', b.tokens),
            calls: b.calls, byModel: {}, byStep: {},
            backfilled: true,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        written++;
        console.log('  ✓ 已写入 ' + b.tokens + ' tokens');
    }
    console.log('');
    if (skippedOrphan) console.log('跳过 ' + skippedOrphan + ' 个已不存在的项目（避免制造孤儿数据）');
    console.log(APPLY ? ('回填完成，写入 ' + written + ' 个项目') : '干跑结束。加 --apply 实际写入。');
    await closePgPool();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
