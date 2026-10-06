#!/usr/bin/env node
/**
 * mergeDefinitionsIntoMaterials.js — item-definitions 并入 materials（默认干跑）
 *
 * 目标：materials 成为装备/功法/线索道具的唯一源，item-definitions 退役。
 * 规则：
 *   - 同名同项目素材存在        → merge：把 def 独有字段(rarity/tags/来源章/属性)补进素材，删 def
 *   - 无同名素材                → create：按 def 新建素材（线索类归入 type 'clue'）
 *   - character-binds.defId    → 重指向素材 id（撞唯一键则合并重复绑定，保留最早获取章）
 * 素材为扁平字段（description/currentContent/tags/…），非嵌套 data。
 *
 * 用法：node scripts/mergeDefinitionsIntoMaterials.js [--project <id>] [--apply] [--json]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AS_JSON = argv.includes('--json');
const pIdx = argv.indexOf('--project');
const PROJECT = pIdx >= 0 ? String(argv[pIdx + 1] || '') : '';

const normName = s => String(s || '').replace(/[《》""''·—－\-\s]/g, '').trim();
const MAT_TYPE = { equipment: 'equipment', 'power-system': 'power-system', technique: 'technique', 'cultivation-method': 'cultivation-method' };
const targetType = def => MAT_TYPE[def.defType] || 'clue';
const defContent = d => [d.detailDesc, d.summaryDesc, d.briefDesc, d.loreDesc].find(x => (x || '').trim()) || '';

function buildPlan(defs, materials, binds) {
    const matByExact = new Map();
    const matByName = new Map();
    for (const m of materials) {
        matByExact.set(`${m.projectId}|${m.type}|${normName(m.name)}`, m);
        if (!matByName.has(`${m.projectId}|${normName(m.name)}`)) matByName.set(`${m.projectId}|${normName(m.name)}`, m);
    }
    const bindById = new Map();
    for (const b of binds) {
        if (!bindById.has(b.defId)) bindById.set(b.defId, []);
        bindById.get(b.defId).push(b);
    }

    const plan = [];
    for (const d of defs) {
        const t = targetType(d);
        const exact = matByExact.get(`${d.projectId}|${t}|${normName(d.name)}`);
        const loose = exact || matByName.get(`${d.projectId}|${normName(d.name)}`) || null;
        const targetId = exact ? exact.id : d.materialId || `mat-${d.id}`;
        plan.push({
            defId: d.id, name: d.name, defType: d.defType, targetType: t,
            action: exact ? 'merge' : 'create',
            targetMaterialId: targetId,
            typeConflict: loose && !exact ? `${d.defType}→${loose.type}` : '',
            binds: (bindById.get(d.id) || []).map(b => b.id),
        });
    }
    return plan;
}

async function applyPlan(store, plan, defsById, materialsById) {
    let merged = 0, created = 0, remapped = 0, droppedBinds = 0;
    const seenBind = new Set();
    for (const p of plan) {
        const d = defsById.get(p.defId);
        if (!d) continue;
        if (p.action === 'create' && !materialsById.has(p.targetMaterialId)) {
            const content = defContent(d);
            await store.setItem('materials', p.targetMaterialId, {
                id: p.targetMaterialId, projectId: d.projectId, type: p.targetType, name: d.name,
                description: content, initialContent: content, currentContent: content,
                sourceChapter: d.sourceChapter ?? null, tags: d.tags || [], rarity: d.rarity || null,
                propertiesJson: d.propertiesJson || {}, constraintsJson: d.constraintsJson || {},
                archived: 0, version: 1, changeLog: [{ action: 'merged-from-definition', from: d.id }],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            });
            created += 1;
        } else if (p.action === 'merge') {
            const m = materialsById.get(p.targetMaterialId);
            if (m) {
                await store.setItem('materials', m.id, {
                    ...m, rarity: m.rarity || d.rarity || null,
                    tags: [...new Set([...(m.tags || []), ...(d.tags || [])])],
                    propertiesJson: { ...(d.propertiesJson || {}), ...(m.propertiesJson || {}) },
                    constraintsJson: { ...(d.constraintsJson || {}), ...(m.constraintsJson || {}) },
                    updatedAt: new Date().toISOString(),
                });
                merged += 1;
            }
        }
        for (const bindId of p.binds) {
            const b = await store.getItem('character-binds', bindId);
            if (!b) continue;
            const key = `${b.characterId}|${p.targetMaterialId}|${b.bindType}`;
            if (seenBind.has(key)) { await store.deleteItem('character-binds', bindId); droppedBinds += 1; continue; }
            seenBind.add(key);
            await store.setItem('character-binds', bindId, { ...b, defId: p.targetMaterialId, updatedAt: new Date().toISOString() });
            remapped += 1;
        }
        await store.deleteItem('item-definitions', p.defId);
    }
    return { merged, created, remapped, droppedBinds };
}

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);
    const store = require('../server/store');
    let defs = await store.queryItems('item-definitions', {});
    let materials = await store.queryItems('materials', {});
    let binds = await store.queryItems('character-binds', {});
    if (PROJECT) {
        defs = defs.filter(d => d.projectId === PROJECT);
        materials = materials.filter(m => m.projectId === PROJECT);
        binds = binds.filter(b => b.projectId === PROJECT);
    }

    const plan = buildPlan(defs, materials, binds);
    const byAction = a => plan.filter(p => p.action === a);
    const remapCount = plan.reduce((n, p) => n + p.binds.length, 0);

    if (APPLY) {
        const defsById = new Map(defs.map(d => [d.id, d]));
        const materialsById = new Map(materials.map(m => [m.id, m]));
        const r = await applyPlan(store, plan, defsById, materialsById);
        console.log(`✅ 合并完成：merge ${r.merged} · create ${r.created} · 重指向绑定 ${r.remapped} · 合并重复绑定 ${r.droppedBinds}`);
        console.log('   建议接着跑：node scripts/verifySourceUniqueness.js');
        return;
    }

    if (AS_JSON) {
        console.log(JSON.stringify({ total: plan.length, merge: byAction('merge').length, create: byAction('create').length, remapBinds: remapCount, plan }, null, 2));
        return;
    }
    console.log('=== item-definitions → materials 合并（干跑）===');
    console.log(`定义 ${plan.length} 条：merge ${byAction('merge').length}（有同名素材）· create ${byAction('create').length}（独有，需新建）· 需重指向绑定 ${remapCount} 条`);
    const conflicts = plan.filter(p => p.typeConflict);
    if (conflicts.length) {
        console.log(`\n⚠️ 类型不一致 ${conflicts.length} 条（同名素材 type 与 def 不同）：`);
        conflicts.slice(0, 10).forEach(p => console.log(`  ${p.name}  ${p.typeConflict}`));
    }
    console.log('\ncreate 明细（独有条目，将新建素材）：');
    byAction('create').slice(0, 20).forEach(p => console.log(`  [${p.targetType}] ${p.name}`));
    console.log('\n（干跑，未写入；加 --apply 生效）');
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
