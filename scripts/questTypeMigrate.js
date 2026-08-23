/**
 * questTypeMigrate.js — 给历史quest补type字段
 *
 * 修复：questHelpers.js新增type字段后，旧项目quest无type
 * 规则：无parentId→main, tags含'阶段任务'→phase, tags含'位面探索'→side
 *
 * 用法：node scripts/questTypeMigrate.js [projectId]
 */
const store = require('../server/store');

async function migrate() {
    const targetProjectId = process.argv[2];
    const allQuests = await store.listItems('quests');
    const quests = targetProjectId
        ? allQuests.filter(q => q.projectId === targetProjectId)
        : allQuests;

    let fixed = 0;
    for (const quest of quests) {
        if (quest.type) continue;

        let type;
        if (!quest.parentId) {
            type = 'main';
        } else if (quest.tags?.includes('阶段任务')) {
            type = 'phase';
        } else if (quest.tags?.includes('位面探索')) {
            type = 'side';
        } else {
            type = 'side';
        }

        quest.type = type;
        quest.updatedAt = new Date().toISOString();
        await store.setItem('quests', quest.id, quest);
        fixed++;
        console.log(`[FIXED] ${quest.title} → type=${type}`);
    }
    console.log(`\n迁移完成: ${fixed}/${quests.length} 个quest已补type字段`);
    process.exit(0);
}

migrate().catch(err => {
    console.error('迁移失败:', err.message);
    process.exit(1);
});
