/**
 * 实体行为规则管理模块
 * 负责从genre插件提取行为规则并注入到实体中
 * 同时包含实体合并和统计功能
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { _recomputePromptTexts } = require('./formatters');

const ENTITY_TYPE = 'entities';

/** 同步到entity-registry的完整字段列表——前端展示所需的所有字段 */
const REGISTRY_SYNC_FIELDS = [
    'id', 'roleLevel', 'firstAppearChapter', 'lastAppearChapter', 'appearCount',
    'position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle',
    'factionName', 'genreId', 'behaviorRules', 'lifecycleState',
    // 人物魅力系统4维度（参考蛊真人方源设计）
    'charisma', 'philosophy', 'quoteLibrary', 'entranceDesign',
];

/**
 * 从genre插件提取角色相关的行为规则
 * protagonist→提取男主/女主行为原则，supporting→提取通用行为约束，npc→提取基本行为约束
 */
function resolveBehaviorRules(genrePlugin, roleLevel) {
    if (!genrePlugin?.characterProfile?.behaviorTemplate) return '';
    const template = genrePlugin.characterProfile.behaviorTemplate;

    if (roleLevel === 'protagonist') {
        return template;
    } else if (roleLevel === 'supporting') {
        const corePrinciple = template.split('核心原则：').pop()?.trim() || '';
        return `【配角行为约束·必须符合人设】\n${corePrinciple}`;
    } else {
        const corePrinciple = template.split('核心原则：').pop()?.trim() || '';
        return `【NPC行为约束·必须符合人设】\n${corePrinciple}`;
    }
}

/**
 * 为项目中的所有角色实体注入/更新behaviorRules
 */
async function injectBehaviorRulesFromGenre(projectId) {
    try {
        const { getStyleProfileForProject } = require('../prompts/styleInjector');
        const { detectGenre } = require('../genreConfig');
        const styleProfile = await getStyleProfileForProject(projectId);
        const genrePlugin = styleProfile ? detectGenre(styleProfile) : null;
        if (!genrePlugin?.characterProfile?.behaviorTemplate) return 0;

        const entities = await store.queryItems(ENTITY_TYPE, { projectId, entityType: 'character' });
        let updated = 0;
        for (const entity of entities) {
            if (entity.lifecycleState === 'archived' || entity.archived) continue;
            const rules = resolveBehaviorRules(genrePlugin, entity.roleLevel);
            if (rules && rules !== entity.behaviorRules) {
                entity.behaviorRules = rules;
                entity.version = (entity.version || 1) + 1;
                entity.updatedAt = new Date().toISOString();
                _recomputePromptTexts(entity);
                await store.setItem(ENTITY_TYPE, entity.id, entity);
                await syncToRegistry(entity);
                updated++;
            }
        }
        if (updated > 0) logger.info('entityCenter', `Injected behaviorRules for ${updated} entities in project ${projectId}`);
        return updated;
    } catch (_) { logger.warn('entityBehaviorRules', '[entity-crud] injectBehaviorRulesFromGenre failed:', _.message || _); return 0; }
}

/** 同步实体数据到entity-registry
 * @param {Object} entity - 实体对象
 * @param {boolean} force - 是否强制覆盖已有字段（PUT路由用户主动修改时传true，空值也会清空registry）
 */
async function syncToRegistry(entity, force = false) {
    if (!entity || entity.entityType !== 'character') return;
    try {
        const entityRegistry = require('../entityRegistry');
        const extra = {};
        for (const field of REGISTRY_SYNC_FIELDS) {
            // force=true时所有字段都加入extra（包括空值，用于清空registry）
            // force=false时只加入非空字段（避免清空已有数据）
            if (force) {
                extra[field] = entity[field];
            } else if (entity[field] !== undefined && entity[field] !== '') {
                extra[field] = entity[field];
            }
        }
        extra.description = (entity.sourceContent || '').substring(0, 200);
        if (entity.genreState && typeof entity.genreState === 'object' && Object.keys(entity.genreState).length > 0) {
            extra.genreState = entity.genreState;
        }
        if (entity.profile && typeof entity.profile === 'object' && Object.keys(entity.profile).some(k => entity.profile[k])) {
            extra.profile = entity.profile;
        }
        await entityRegistry.registerEntity(entity.projectId, entity.entityType, entity.name, extra, { force });
    } catch (_) { logger.warn('entityBehaviorRules', '[entity-crud]', _.message || _); }
}

/** 合并已有实体的字段（不覆盖已有值，只填充空字段） */
async function mergeExistingEntity(center, existing, defaults) {
    const updates = {};
    const mergeableFields = ['position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'sourceContent', 'behaviorRules', 'charisma', 'philosophy', 'quoteLibrary', 'entranceDesign'];
    for (const field of mergeableFields) { if (defaults[field] && defaults[field] !== existing[field]) updates[field] = defaults[field]; }
    if (defaults.genreState && typeof defaults.genreState === 'object') updates.genreState = { ...existing.genreState, ...defaults.genreState };
    if (defaults.profile && typeof defaults.profile === 'object') updates.profile = { ...existing.profile, ...defaults.profile };
    const roleLevelPriority = { protagonist: 3, supporting: 2, npc: 1 };
    if ((roleLevelPriority[defaults.roleLevel] || 0) > (roleLevelPriority[existing.roleLevel] || 0)) updates.roleLevel = defaults.roleLevel;
    const chapterSource = defaults.sourceChapter || defaults.firstAppearChapter || defaults.lastAppearChapter;
    if (chapterSource) updates.lastAppearChapter = Math.max(existing.lastAppearChapter || 0, chapterSource);
    if (Object.keys(updates).length > 0) {
        const { updateEntity } = require('./entityCRUD');
        const updated = await updateEntity(existing.id, updates);
        logger.info('entityCenter', `Merged existing entity: "${existing.name}" (${existing.id}), updated: ${Object.keys(updates).join(',')}`);
        return updated || existing;
    }
    return existing;
}

/** 获取项目实体统计信息 */
async function getEntityStats(projectId) {
    const { getEntitiesForProject } = require('./entityCRUD');
    const entities = await getEntitiesForProject(projectId);
    const stats = { total: entities.length, byType: {}, byRole: {}, duplicates: [] };
    for (const e of entities) {
        stats.byType[e.entityType] = (stats.byType[e.entityType] || 0) + 1;
        stats.byRole[e.roleLevel] = (stats.byRole[e.roleLevel] || 0) + 1;
    }
    const nameCount = {};
    entities.filter(e => e.entityType === 'character').forEach(e => {
        const key = `${e.entityType}:${e.name}`;
        nameCount[key] = (nameCount[key] || 0) + 1;
    });
    Object.entries(nameCount).forEach(([key, count]) => { if (count > 1) stats.duplicates.push({ key, count }); });
    return stats;
}

module.exports = {
    resolveBehaviorRules,
    injectBehaviorRulesFromGenre,
    syncToRegistry,
    mergeExistingEntity,
    getEntityStats,
    REGISTRY_SYNC_FIELDS,
};
