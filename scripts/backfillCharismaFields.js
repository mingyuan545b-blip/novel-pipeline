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
    // 兜底内容源：实体 sourceContent 常被截断（如仅 219 字），回落同名角色素材正文
    const mats = await store.queryItems('materials', { projectId, type: 'character' });
    const matByName = new Map(mats.filter(m => !m.archived).map(m => [m.name, m]));

    let updated = 0;
    let skipped = 0;
    for (const entity of targets) {
        const mat = matByName.get(entity.name);
        const matContent = mat ? (mat.currentContent || mat.initialContent || '') : '';
        // 优先取更完整的来源：素材正文通常比实体 sourceContent（截断 2000 字）更全
        const content = (matContent.length > (entity.sourceContent || '').length)
            ? matContent
            : (entity.sourceContent || matContent || '');
        if (!content || content.length < 20) { skipped++; continue; }

        const parsed = extractCharacterStateFromContent(content, {});
        const updates = {};
        if (parsed.charisma && !entity.charisma) updates.charisma = parsed.charisma;
        if (parsed.philosophy && !entity.philosophy) updates.philosophy = parsed.philosophy;
        if (parsed.entranceDesign && !entity.entranceDesign) updates.entranceDesign = parsed.entranceDesign;
        if (parsed.craftStyle && !entity.craftStyle) updates.craftStyle = parsed.craftStyle;
        if (parsed.speakingTone && !entity.speakingTone) updates.speakingTone = parsed.speakingTone;
        if (parsed.factionName && !entity.factionName) updates.factionName = parsed.factionName;
        if (Array.isArray(parsed.highlightScenes) && parsed.highlightScenes.length > 0 &&
            (!Array.isArray(entity.highlightScenes) || entity.highlightScenes.length === 0)) {
            updates.highlightScenes = parsed.highlightScenes;
        }
        if (Array.isArray(parsed.quoteLibrary) && parsed.quoteLibrary.length > 0 &&
            (!Array.isArray(entity.quoteLibrary) || entity.quoteLibrary.length === 0)) {
            updates.quoteLibrary = parsed.quoteLibrary;
        }
        // 人物四件套 → profile
        const prof = {};
        for (const k of ['desire', 'fear', 'lie', 'trauma']) {
            if (parsed[k] && !(entity.profile || {})[k]) prof[k] = parsed[k];
        }
        if (Object.keys(prof).length > 0) updates.profile = { ...(entity.profile || {}), ...prof };

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
