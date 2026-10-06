/**
 * Agent素材调度辅助函数
 * 包含约束加载、实体格式化、状态构建、限知加载等工具函数
 */
const logger = require('../../shared/logger');

/** 加载实体行为规则 */
async function _loadEntityRules(projectId) {
    try {
        const entityCenter = require('../entityCenter');
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        const protagonists = entities.filter(e => e.roleLevel === 'protagonist' && e.behaviorRules);
        if (protagonists.length > 0) {
            return { name: protagonists[0].name, content: protagonists[0].behaviorRules };
        }
    } catch (_) { /* silent */ }
    return null;
}

/** 加载题材行为规则 */
function _loadGenreRules(genre) {
    if (genre?.characterProfile?.behaviorTemplate) {
        return { key: genre.id, content: genre.characterProfile.behaviorTemplate };
    }
    return null;
}

/** 加载全局一致性约束 */
async function _loadGlobalRules(projectId, ctx) {
    try {
        const { getActiveConstraints, formatConstraintsForPrompt } = require('../consistencyConstraint');
        const constraints = await getActiveConstraints(projectId, 0);
        const text = formatConstraintsForPrompt(constraints);
        if (text) return { key: 'consistency', content: text };
    } catch (_) { /* silent */ }
    return null;
}

/** 格式化实体文本 */
function formatEntity(entity, detail, maxLen) {
    const parts = [];
    if (entity.position) parts.push(`【身份】${entity.position}`);
    if (entity.personality) parts.push(`【性格】${entity.personality}`);
    if (entity.speakingTone) parts.push(`【语调】${entity.speakingTone}`);
    if (entity.craftStyle) parts.push(`【风格】${entity.craftStyle}`);
    if (entity.signatureDetail) parts.push(`【标志】${entity.signatureDetail}`);
    if (entity.summaryText) parts.push(entity.summaryText);
    else if (entity.briefText) parts.push(entity.briefText);
    return parts.join('\n').substring(0, maxLen);
}

/** 构建状态JSON（含KV索引动态状态）
 *  合并entity静态字段 + stateKVIndex动态状态（如石化进度/HP/战力等）
 *  动态状态优先级高于静态字段，确保writer看到最新状态
 */
async function buildStateJson(entity, projectId) {
    const state = { name: entity.name, roleLevel: entity.roleLevel };
    if (entity.lifecycleState && entity.lifecycleState !== 'active') state.lifecycleState = entity.lifecycleState;
    if (entity.position) state.position = entity.position;
    if (entity.personality) state.personality = entity.personality;
    if (entity.speakingTone) state.speakingTone = entity.speakingTone;
    // S2 深度键生产端：真实产出契约依赖的 innerConflict/independentStance/fateArc/protagonistMirror
    // （此前只映射浅字段 + KV，且 KV 读取键与写入键不一致 → 契约全链路判定为缺深度）
    const profile = entity.profile || {};
    const deep = {
        innerConflict: entity.innerConflict || profile.innerConflict,
        independentStance: entity.independentStance || profile.independentStance,
        fateArc: entity.fateArc || profile.fateArc,
        protagonistMirror: entity.protagonistMirror || profile.protagonistMirror,
    };
    for (const [k, v] of Object.entries(deep)) if (v) state[k] = v;
    if (entity.genreState && typeof entity.genreState === 'object') Object.assign(state, entity.genreState);

    // 读取KV索引中的动态状态（石化进度/HP/战力等题材特有字段）
    if (projectId && entity.id) {
        try {
            const stateKVIndex = require('../stateKVIndex');
            const dynamicState = await stateKVIndex.getEntityState(projectId, 'character', entity.id);
            if (dynamicState && typeof dynamicState === 'object') {
                // 排除内部字段，动态状态覆盖静态字段
                for (const [key, value] of Object.entries(dynamicState)) {
                    if (key === '_lastStateId' || key === 'stateChangedFields') continue;
                    if (value !== null && value !== undefined && value !== '') {
                        state[key] = value;
                    }
                }
            }
        } catch (err) {
            logger.warn('materialHelpers', `Failed to load dynamic state for ${entity.name}: ${err.message}`);
        }
    }
    return state;
}

/** 获取生命周期过滤状态 */
function getLifecycleStates(agentType) {
    const { getLifecycleFilter } = require('./agentDeclarations');
    const filter = getLifecycleFilter(agentType);
    if (filter === 'writer') {
        const { CHARACTER_LIFECYCLE } = require('../entityCenter/entityLifecycle');
        return Object.entries(CHARACTER_LIFECYCLE).filter(([, v]) => v.visibleToWriter).map(([k]) => k);
    }
    if (filter === 'reviewer') {
        const { CHARACTER_LIFECYCLE } = require('../entityCenter/entityLifecycle');
        return Object.entries(CHARACTER_LIFECYCLE).filter(([, v]) => v.visibleToReviewer).map(([k]) => k);
    }
    return null;
}

/** 加载限知认知数据 */
async function _loadKnowledgeAccess(need, projectId, chapter) {
    const items = [];
    try {
        const knowledgeAccess = require('../knowledgeBase/knowledgeAccess');
        const entityCenter = require('../entityCenter');
        const chapterNum = chapter?.chapterNumber || 0;

        const allAccess = await knowledgeAccess.getAccessByProject(projectId);
        if (allAccess.length === 0) return { items };

        // 获取实体名映射
        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        const entityNames = {};
        for (const e of entities) entityNames[e.id] = e.name;

        // 按章节过滤：只加载当前章节及之前已知的记录
        const relevant = allAccess.filter(a => (a.sinceChapter || 0) <= chapterNum);

        // 按精度级别格式化，budget控制总量
        const budget = need.budget || 600;
        const formatted = knowledgeAccess.formatAccessForPrompt(relevant, entityNames);
        if (formatted) {
            const content = formatted.substring(0, budget);
            items.push({
                type: 'knowledge-access',
                content,
                source: 'knowledge-access',
            });
        }
    } catch (e) {
        logger.warn('materialHelpers', `Knowledge access load failed: ${e.message}`);
    }
    return { items };
}

module.exports = {
    _loadEntityRules,
    _loadGenreRules,
    _loadGlobalRules,
    _loadKnowledgeAccess,
    formatEntity,
    buildStateJson,
    getLifecycleStates,
};
