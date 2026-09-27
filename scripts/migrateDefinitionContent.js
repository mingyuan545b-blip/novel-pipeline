#!/usr/bin/env node
/**
 * migrateDefinitionContent.js — 装备/功法“定义内容”去重（默认干跑）
 *
 * 背景（P0-3 止血）：item-definitions 曾复制 materials 的描述内容（双存）。
 * 新写入已不再复制；本脚本处理**历史数据**：
 *   - 同名素材存在 → 定义行只留身份：回指 materialId、清空 4 级描述（内容唯一存 materials）
 *   - 同名素材不存在 → 保留内容（否则会丢信息），并列入"待处理"
 *
 * 用法：node scripts/migrateDefinitionContent.js [--project <id>] [--apply] [--json]
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

    let defs = await store.queryItems('item-definitions', {});
    let materials = await store.queryItems('materials', {});
    if (PROJECT) { defs = defs.filter(d => d.projectId === PROJECT); materials = materials.filter(m => m.projectId === PROJECT); }

    const matByName = new Map();
    for (const m of materials) if (m.type === 'equipment' || m.type === 'technique') matByName.set(m.projectId + '|' + m.name, m);

    const plan = [];
    for (const d of defs) {
        const hasContent = Boolean((d.detailDesc || '').trim() || (d.briefDesc || '').trim());
        if (!hasContent) continue;
        const hit = matByName.get(d.projectId + '|' + d.name);
        plan.push({ id: d.id, name: d.name, action: hit ? 'strip+link' : 'keep(no-material)', materialId: hit?.id || null });
    }

    if (APPLY) {
        let n = 0;
        for (const p of plan) {
            if (p.action !== 'strip+link') continue;
            const d = await store.getItem('item-definitions', p.id);
            if (!d) continue;
            await store.setItem('item-definitions', p.id, {
                ...d, materialId: p.materialId,
                briefDesc: '', summaryDesc: '', detailDesc: '', loreDesc: '',
                briefTokens: 0, summaryTokens: 0, detailTokens: 0, loreTokens: 0,
                updatedAt: new Date().toISOString(),
            });
            n += 1;
        }
        console.log(`✅ 已处理 ${n} 条定义（清空复制内容并回指素材）`);
        return;
    }

    const strip = plan.filter(p => p.action === 'strip+link');
    const keep = plan.filter(p => p.action !== 'strip+link');
    if (AS_JSON) { console.log(JSON.stringify({ total: plan.length, strip: strip.length, keep: keep.length, plan }, null, 2)); return; }
    console.log('=== 定义内容去重（干跑）===');
    console.log(`含内容定义 ${plan.length} 条：可止血 ${strip.length}（有同名素材）· 保留 ${keep.length}（无同名素材）`);
    strip.slice(0, 8).forEach(p => console.log(`  strip+link  ${p.name}`));
    keep.slice(0, 8).forEach(p => console.log(`  keep        ${p.name}（无同名素材，保留内容）`));
    console.log('\n（干跑，未写入；加 --apply 生效）');
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
