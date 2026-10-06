#!/usr/bin/env node
/**
 * migrateCharacterKVKeys.js — 角色状态 KV 键迁移（material id → entity id）
 *
 * 背景（S2 根因）：状态 KV 写入路径曾以"素材 id"为 entityKey，而全部读取路径
 * （buildStateJson / characterDepthExtractor / characterStatesSummary）以"实体 id"为键，
 * 导致 innerConflict/independentStance/fateArc 等深度字段永远读不到（契约全链路失败）。
 * 写入端已在 S2 统一为实体 id；本脚本把存量数据一并改键。
 *
 * 用法：node scripts/migrateCharacterKVKeys.js [--project <id>] [--apply] [--json]
 *   默认干跑（只报告不改）。--apply 才写库。
 */
const store = require('../server/store');
const { _makeKVId, KV_STORE_TYPE, STATE_STORE_TYPE, _makeStateId } = require('../server/services/stateKVHelpers');

const APPLY = process.argv.includes('--apply');
const JSON_OUT = process.argv.includes('--json');
const projIdx = process.argv.indexOf('--project');
const onlyProject = projIdx >= 0 ? process.argv[projIdx + 1] : null;

async function migrateProject(projectId, report) {
    const [materials, entities] = await Promise.all([
        store.queryItems('materials', { projectId, type: 'character' }),
        store.queryItems('entities', { projectId, entityType: 'character' }),
    ]);
    const matNameById = new Map(materials.map(m => [m.id, m.name]));
    const entityIdByName = new Map(entities.map(e => [e.name, e.id]));

    const kvItems = await store.queryItems(KV_STORE_TYPE, { projectId, scope: 'character' });
    for (const item of kvItems) {
        const name = matNameById.get(item.entityKey);
        if (!name) continue;                       // 键不是素材 id → 无需迁移
        const targetId = entityIdByName.get(name);
        if (!targetId || targetId === item.entityKey) continue;
        const newId = _makeKVId(projectId, 'character', targetId, item.dataKey);
        report.rows.push({ kind: 'kv', projectId, from: item.entityKey, to: targetId, dataKey: item.dataKey });
        if (APPLY) {
            await store.setItem(KV_STORE_TYPE, newId, { ...item, id: newId, entityKey: targetId });
            await store.deleteItem(KV_STORE_TYPE, item.id);
        }
    }

    const stateRecords = await store.queryItems(STATE_STORE_TYPE, { projectId });
    for (const rec of stateRecords) {
        const name = matNameById.get(rec.characterId);
        if (!name) continue;
        const targetId = entityIdByName.get(name);
        if (!targetId || targetId === rec.characterId) continue;
        const newId = _makeStateId(targetId, rec.chapterNumber);
        report.rows.push({ kind: 'state', projectId, from: rec.characterId, to: targetId, chapter: rec.chapterNumber });
        if (APPLY) {
            await store.setItem(STATE_STORE_TYPE, newId, { ...rec, id: newId, characterId: targetId });
            await store.deleteItem(STATE_STORE_TYPE, rec.id);
        }
    }
}

(async () => {
    await store.ensureBackend();
    const projects = onlyProject ? [{ id: onlyProject }] : await store.listItems('projects');
    const report = { apply: APPLY, rows: [] };
    for (const p of projects) await migrateProject(p.id, report);
    if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
    else {
        console.log(`${APPLY ? '应用' : '干跑'}：待迁移 ${report.rows.length} 条（kv ${report.rows.filter(r => r.kind === 'kv').length} / state ${report.rows.filter(r => r.kind === 'state').length}）`);
        for (const r of report.rows.slice(0, 20)) console.log(`  [${r.kind}] ${r.from} → ${r.to}${r.dataKey ? ' (' + r.dataKey + ')' : ''}`);
        if (!APPLY) console.log('（干跑模式，未写库；加 --apply 生效）');
    }
})().catch(e => { console.error('migrateCharacterKVKeys failed:', e.message); process.exit(1); });
