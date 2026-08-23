/**
 * servantDecisionEngine.js — 仆从/宠物独立决策引擎
 * 根据主人是否在场、场景类型、状态变化决定加载深度
 */
const { SERVANT_BIND_TYPES, SERVANT_LOAD_RULES } = require('./contextDepthConstants');
const { detectSceneTypes } = require('./contextDecisionRules');
const logger = require('../../shared/logger');

/**
 * 解析仆从/宠物的加载决策
 * @param {object} servantEntity - 仆从实体
 * @param {object} params - { chapter, entities, outlineText }
 * @returns {object} { shouldLoad, depth, reason }
 */
function resolveServantLoad(servantEntity, params) {
    const { chapter, entities, outlineText } = params;

    const bindInfo = _extractBindInfo(servantEntity);
    if (!bindInfo) return { shouldLoad: false, depth: null, reason: '非仆从/宠物绑定' };

    const owner = _findOwner(bindInfo.ownerName, entities);
    const sceneTypes = detectSceneTypes(outlineText);
    const isCombat = sceneTypes.some(s => s.scene === 'combat');
    const isOwnerPresent = _isOwnerInOutline(owner, outlineText);
    const isOwnerProtagonist = owner?.roleLevel === 'protagonist';
    const hasStateChange = _hasStateChange(servantEntity, chapter);

    if (isCombat && isOwnerPresent) {
        return { shouldLoad: true, depth: SERVANT_LOAD_RULES.combatScene, reason: '战斗场景+主人在场' };
    }

    if (hasStateChange) {
        return { shouldLoad: true, depth: SERVANT_LOAD_RULES.stateChange, reason: '仆从状态变化' };
    }

    if (isOwnerProtagonist && isOwnerPresent) {
        return { shouldLoad: true, depth: SERVANT_LOAD_RULES.ownerIsProtagonist, reason: '主角仆从+主人在场' };
    }

    if (isOwnerPresent) {
        return { shouldLoad: true, depth: SERVANT_LOAD_RULES.ownerPresent, reason: '主人在场' };
    }

    if (isOwnerProtagonist) {
        return { shouldLoad: true, depth: SERVANT_LOAD_RULES.ownerAbsent, reason: '主角仆从但主人不在场' };
    }

    return { shouldLoad: false, depth: null, reason: '主人不在场且非主角仆从' };
}

/**
 * 批量解析仆从决策
 * @param {Array} servantEntities - 仆从实体列表
 * @param {object} params - 同resolveServantLoad
 * @returns {Array} 决策结果列表
 */
function resolveServantLoads(servantEntities, params) {
    return servantEntities.map(entity => ({
        entity,
        ...resolveServantLoad(entity, params),
    }));
}

/** 从实体提取绑定信息 */
function _extractBindInfo(entity) {
    const binds = entity.bindsSummary || entity.binds || [];
    const servantBind = binds.find(b => SERVANT_BIND_TYPES.has(b.bindType || b.type));
    if (!servantBind) return null;
    return {
        bindType: servantBind.bindType || servantBind.type,
        ownerName: servantBind.ownerName || servantBind.boundTo || null,
    };
}

/** 在实体列表中查找主人 */
function _findOwner(ownerName, entities) {
    if (!ownerName || !entities) return null;
    return entities.find(e => e.name === ownerName) || null;
}

/** 判断主人是否在大纲中出现 */
function _isOwnerInOutline(owner, outlineText) {
    if (!owner || !outlineText) return false;
    return outlineText.includes((owner.name || '').toLowerCase());
}

/** 判断仆从是否有状态变化 */
function _hasStateChange(entity, chapter) {
    if (!chapter || !entity.genreState) return false;
    const chapterNum = chapter.chapterNumber || chapter.number;
    const stateHistory = entity.stateHistory || [];
    return stateHistory.some(h => h.chapter === chapterNum);
}

module.exports = { resolveServantLoad, resolveServantLoads };
