/**
 * backfillItemStages.js — 回填 item-definitions.propertiesJson.stages
 *
 * 用法: node scripts/backfillItemStages.js [projectId] [--apply]
 *   默认只读（干跑），加 --apply 才写库。
 * 内容源：定义回指的素材（materialId）→ 同名素材 → 定义自身的 desc 字段。
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');
const { buildItemProperties } = require('../server/services/itemStageParser');

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const projectId = args.find(a => !a.startsWith('--'));
    await store.ensureBackend();
    const defs = await store.queryItems('item-definitions', projectId ? { projectId } : {});
    const mats = await store.queryItems('materials', projectId ? { projectId } : {});
    const matById = new Map(mats.map(m => [m.id, m]));
    const matByName = new Map(mats.map(m => [m.name, m]));

    let updated = 0, skipped = 0, noStage = 0;
    for (const def of defs) {
        if (def.propertiesJson && Array.isArray(def.propertiesJson.stages) && def.propertiesJson.stages.length > 0) { skipped++; continue; }
        const mat = (def.materialId && matById.get(def.materialId)) || matByName.get(def.name);
        const content = mat ? (mat.currentContent || mat.initialContent || '') : [def.detailDesc, def.summaryDesc, def.briefDesc].filter(Boolean).join('\n');
        const props = buildItemProperties(content || '');
        if (!props.stages || props.stages.length === 0) { noStage++; continue; }
        if (apply) {
            def.propertiesJson = { ...(def.propertiesJson || {}), ...props };
            def.updatedAt = new Date().toISOString();
            await store.setItem('item-definitions', def.id, def);
        }
        updated++;
    }
    console.log(`${apply ? '[APPLY]' : '[DRY-RUN]'} definitions=${defs.length} 已含stages跳过=${skipped} 可回填=${updated} 无阶段可解析=${noStage}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
