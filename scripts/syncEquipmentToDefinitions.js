/**
 * syncEquipmentToDefinitions.js — 补同步现有 equipment materials 到 item-definitions 表
 *
 * 根因：materialCreateHelpers.syncToRegistries 在创建 equipment material 时应同步到
 * item-definitions 表，但老数据创建时该逻辑未执行或不存在，导致前端 UI 查
 * item-definitions 表时显示0条装备。
 *
 * 本脚本扫描所有项目的 equipment 类型 materials，补同步到 item-definitions 表。
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const store = require('../server/store');
const itemDefinition = require('../server/services/itemDefinition');

async function syncProjectEquipment(projectId) {
    const materials = await store.queryItems('materials', { projectId, type: 'equipment' });
    let synced = 0, skipped = 0;
    for (const mat of materials) {
        const defId = `def-equip-${mat.id}`;
        const existing = await store.getItem('item-definitions', defId);
        if (existing) { skipped++; continue; }

        const content = mat.content || mat.description || '';
        await itemDefinition.createDefinition(projectId, 'equipment', mat.name, {
            id: defId,
            briefDesc: content.substring(0, 100) || mat.name,
            summaryDesc: content.substring(0, 300) || mat.name,
            detailDesc: content.substring(0, 800) || mat.name,
            sourceChapter: mat.sourceChapter || mat.firstAppearChapter || null,
            tags: ['migrated-from-materials']
        });
        synced++;
        console.log(`  ✅ synced: ${mat.name} (id=${mat.id})`);
    }
    return { synced, skipped, total: materials.length };
}

(async () => {
    console.log('=== 装备 materials → item-definitions 同步 ===');
    const projects = await store.listItems('projects');
    let totalSynced = 0, totalSkipped = 0;
    for (const proj of projects) {
        const r = await syncProjectEquipment(proj.id);
        if (r.total > 0) {
            console.log(`[${proj.name}] total=${r.total} synced=${r.synced} skipped=${r.skipped}`);
            totalSynced += r.synced;
            totalSkipped += r.skipped;
        }
    }
    console.log(`\n完成: 同步 ${totalSynced} 条，跳过 ${totalSkipped} 条已存在`);
    process.exit(0);
})().catch(e => { console.error('迁移失败:', e.message); process.exit(1); });
