/**
 * 主角人格魅力4维度字段回填脚本
 * 从已有 entity.sourceContent 中重新解析【人格魅力】【哲学观】【金句库】【出场设计】标签
 * 填充到 entity 的 charisma/philosophy/quoteLibrary/entranceDesign 字段
 *
 * 用法: node scripts/backfillCharismaFields.js [projectId]
 *   projectId 省略时回填所有项目的主角和配角
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

// 加载 .env 环境变量，确保脚本使用与 server 相同的 backend (PostgreSQL)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const store = require('../server/store');
const { extractCharacterStateFromContent } = require('../server/services/pipeline/characterStateExtractor');
const { _recomputePromptTexts } = require('../server/services/entityCenter/formatters');
const { syncToRegistry } = require('../server/services/entityCenter/entityBehaviorRules');
const logger = require('../server/shared/logger');

const ENTITY_TYPE = 'entities';

async function backfillProject(projectId) {
    const filter = { projectId, entityType: 'character' };
    const entities = await store.queryItems(ENTITY_TYPE, filter);
    const targets = entities.filter(e =>
        (e.roleLevel === 'protagonist' || e.roleLevel === 'supporting') &&
        e.lifecycleState !== 'archived' && !e.archived
    );

    let updated = 0;
    let skipped = 0;
    for (const entity of targets) {
        const content = entity.sourceContent || '';
        if (!content || content.length < 20) { skipped++; continue; }

        const parsed = extractCharacterStateFromContent(content, {});
        const updates = {};
        if (parsed.charisma && !entity.charisma) updates.charisma = parsed.charisma;
        if (parsed.philosophy && !entity.philosophy) updates.philosophy = parsed.philosophy;
        if (parsed.entranceDesign && !entity.entranceDesign) updates.entranceDesign = parsed.entranceDesign;
        if (Array.isArray(parsed.quoteLibrary) && parsed.quoteLibrary.length > 0 &&
            (!Array.isArray(entity.quoteLibrary) || entity.quoteLibrary.length === 0)) {
            updates.quoteLibrary = parsed.quoteLibrary;
        }

        if (Object.keys(updates).length === 0) {
            skipped++;
            continue;
        }

        Object.assign(entity, updates);
        entity.version = (entity.version || 1) + 1;
        entity.updatedAt = new Date().toISOString();
        _recomputePromptTexts(entity);
        await store.setItem(ENTITY_TYPE, entity.id, entity);
        await syncToRegistry(entity);
        updated++;
        logger.info('backfill', `[${projectId}] ${entity.name}(${entity.roleLevel}) 填充: ${Object.keys(updates).join(',')}`);
    }
    return { updated, skipped, total: targets.length };
}

async function main() {
    const targetProjectId = process.argv[2];
    const projectFilter = targetProjectId ? { id: targetProjectId } : {};
    const projects = await store.queryItems('projects', projectFilter);

    let totalUpdated = 0;
    let totalSkipped = 0;
    for (const project of projects) {
        const r = await backfillProject(project.id);
        totalUpdated += r.updated;
        totalSkipped += r.skipped;
        console.log(`项目 ${project.name}(${project.id}): 更新${r.updated}/${r.total}, 跳过${r.skipped}`);
    }
    console.log(`\n总计: 更新${totalUpdated}个角色, 跳过${totalSkipped}个角色`);
    process.exit(0);
}

main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
