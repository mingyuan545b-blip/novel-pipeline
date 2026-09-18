/**
 * repairArchivedMaterials.js — 修复被误归档的受保护素材
 *
 * 背景：章节返修时 cleanChapterMaterials 曾用"名字含'主角'"判定保护，
 * 导致现代命名的主角/关键配角被误归档（实测某项目 37 条素材 19 条被归档）。
 *
 * 用法：
 *   node scripts/repairArchivedMaterials.js <projectId>           # 干跑，只列出
 *   node scripts/repairArchivedMaterials.js <projectId> --apply   # 实际恢复
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');
const { isProtectedMaterial } = require('../server/services/pipeline/steps/materialLifecycle');

const PROJECT_ID = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!PROJECT_ID) { console.error('用法: node scripts/repairArchivedMaterials.js <projectId> [--apply]'); process.exit(1); }

(async () => {
    const materials = await store.queryItems('materials', { projectId: PROJECT_ID });
    const chapters = await store.queryItems('chapters', { projectId: PROJECT_ID });
    const maxChapter = chapters.reduce((max, c) => Math.max(max, c.chapterNumber || 0), 0);
    const targets = materials.filter((m) => m.archived && isProtectedMaterial(m, maxChapter));

    console.log(`项目 ${PROJECT_ID}: 素材${materials.length} 条，其中已归档${materials.filter((m) => m.archived).length} 条`);
    console.log(`受保护但被归档（应恢复）: ${targets.length} 条`);
    for (const m of targets) {
        console.log(`  - [${m.type}] ${m.name} | roleLevel=${m.roleLevel || '-'} lastAppear=${m.lastAppearChapter ?? '-'} | 归档原因=${m.archivedReason || '-'}`);
    }
    if (!APPLY) { console.log('\n（干跑模式，未修改数据；加 --apply 实际恢复）'); process.exit(0); }

    let restored = 0;
    for (const m of targets) {
        m.archived = false;
        m.updatedAt = new Date().toISOString();
        m.restoredReason = `误归档修复（原原因：${m.archivedReason || '-'}）`;
        delete m.archivedReason;
        delete m.archivedAt;
        await store.setItem('materials', m.id, m);
        restored++;
    }
    console.log(`\n已恢复 ${restored} 条素材`);
    process.exit(0);
})().catch((e) => { console.error('修复失败:', e.message); process.exit(1); });
