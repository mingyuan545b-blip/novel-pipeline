#!/usr/bin/env node
/**
 * verifySourceUniqueness.js — 素材“单一源”体检（只读）
 *
 * 检查同一事实是否被多处落盘（P0-3 双存止血的可观测手段）：
 *   1) 装备/功法：同名同时存在于 item-definitions 与 materials(equipment/technique)？
 *   2) 世界观：同名同时存在于 materials.worldview 与 KV(state-kv-index, scope=worldview)？
 *   3) 定义行是否仍复制了内容（desc 非空 = 双存未止血的迹象）
 *
 * 用法：node scripts/verifySourceUniqueness.js [--project <id>] [--json]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');

    let materials = await store.queryItems('materials', {});
    let defs = await store.queryItems('item-definitions', {});
    let kv = await store.queryItems('state-kv-index', {});
    if (PROJECT) {
        materials = materials.filter(m => m.projectId === PROJECT);
        defs = defs.filter(d => d.projectId === PROJECT);
        kv = kv.filter(k => k.projectId === PROJECT);
    }

    const byProject = new Map();
    const bucket = (pid) => { if (!byProject.has(pid)) byProject.set(pid, { equipmentDup: [], worldviewDup: [], defsWithContent: 0, defs: 0, materials: 0, kvWorldview: 0 }); return byProject.get(pid); };

    const matNames = new Map();   // pid -> Set(name) for equipment/technique
    for (const m of materials) {
        const b = bucket(m.projectId); b.materials += 1;
        if (m.type === 'equipment' || m.type === 'technique') {
            if (!matNames.has(m.projectId)) matNames.set(m.projectId, new Map());
            matNames.get(m.projectId).set(m.name, m);
        }
    }
    for (const d of defs) {
        const b = bucket(d.projectId); b.defs += 1;
        const hasContent = Boolean((d.detailDesc || '').trim() || (d.briefDesc || '').trim());
        if (hasContent) b.defsWithContent += 1;
        const hit = matNames.get(d.projectId)?.get(d.name);
        if (hit) b.equipmentDup.push({ name: d.name, defId: d.id, materialId: hit.id, linked: d.materialId === hit.id });
    }
    const kvWv = new Map();
    const matWv = new Map();
    for (const m of materials) if (m.type === 'worldview') matWv.set(m.projectId + '|' + m.name, m);
    for (const k of kv) {
        if (k.scope !== 'worldview') continue;
        kvWv.set(k.projectId + '|' + k.entityKey, k);   // 去重：同一主题的 evolution/type/detail 是 3 行
    }
    for (const pid of byProject.keys()) byProject.get(pid).kvWorldview = [...kvWv.keys()].filter(k => k.startsWith(pid + '|')).length;
    for (const [key] of kvWv) {
        const pid = key.split('|')[0];
        if (matWv.has(key)) bucket(pid).worldviewDup.push(key.split('|')[1]);
    }

    const report = [...byProject.entries()].map(([pid, b]) => ({
        projectId: pid,
        materials: b.materials, defs: b.defs, defsWithContent: b.defsWithContent,
        equipmentDupCount: b.equipmentDup.length, equipmentDupLinked: b.equipmentDup.filter(d => d.linked).length,
        worldviewDupCount: b.worldviewDup.length, kvWorldview: b.kvWorldview,
        sample: { equipment: b.equipmentDup.slice(0, 5).map(d => d.name), worldview: b.worldviewDup.slice(0, 5) },
    })).sort((a, b) => (b.equipmentDupCount + b.worldviewDupCount) - (a.equipmentDupCount + a.worldviewDupCount));

    if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); return; }
    console.log('=== 素材单一源体检 ===');
    for (const r of report) {
        const flag = (r.equipmentDupCount || r.worldviewDupCount) ? '⚠' : '✅';
        console.log(`${flag} ${r.projectId.slice(0, 12)}… 素材${r.materials} 定义${r.defs}(含内容${r.defsWithContent})`);
        if (r.equipmentDupCount) console.log(`    装备/功法双存 ${r.equipmentDupCount}（已回指素材 ${r.equipmentDupLinked}）如: ${r.sample.equipment.join(' / ')}`);
        if (r.worldviewDupCount) console.log(`    世界观双存 ${r.worldviewDupCount}（KV 世界观主题 ${r.kvWorldview}）如: ${r.sample.worldview.join(' / ')}`);
    }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
