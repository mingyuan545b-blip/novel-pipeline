/**
 * 大纲装备绑定创建模块
 * 从outlineMaterialSaver.js拆分
 */

const logger = require('../../shared/logger');
const store = require('../../store');
const { v4: uuidv4 } = require('uuid');
const { inferPermanence } = require('../../services/characterBind');
const { buildCharNameMap } = require('./outlineRelationCreator');
const { resolveMaterialName } = require('./materialNameResolver');
const { buildItemProperties } = require('../itemStageParser');

function buildItemDefinition(defId, projectId, mat) {
    // P0-3 止血：内容唯一存 materials，定义行**不再复制 4 级描述**，只保留身份并回指素材
    return {
        id: defId, projectId, defType: mat.type, name: resolveMaterialName(mat),
        materialId: mat.id || null,
        rarity: 'common', briefDesc: '', summaryDesc: '', detailDesc: '', loreDesc: '',
        briefTokens: 0, summaryTokens: 0, detailTokens: 0, loreTokens: 0,
        propertiesJson: buildItemProperties(mat.content || ''), constraintsJson: {},
        sourceChapter: 0, tags: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
}

function buildCharBind(bindId, projectId, ownerId, defId, mat) {
    const bindType = mat.type === 'equipment' ? 'equipment' : 'technique';
    return {
        id: bindId, projectId, characterId: ownerId, defId,
        bindType, bindStatus: 'active',
        permanence: inferPermanence(mat.content || '', bindType),
        acquiredChapter: 0, lostChapter: null, masteryLevel: '初学', masteryProgress: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
}

/** 需要创建item-definition + bind的素材类型 */
const BINDABLE_TYPES = new Set(['equipment', 'power-system', 'technique', 'cultivation-method']);

async function createEquipmentBinds(projectId, materials, createdItems) {
    const charNameToId = buildCharNameMap(materials, createdItems);
    for (const mat of materials) {
        if (!BINDABLE_TYPES.has(mat.type) || !mat.content) continue;
        try {
            // 先确保 item-definition 存在（幂等：按名字复用，避免重复定义）
            const defName = resolveMaterialName(mat);
            const existingDefs = await store.queryItems('item-definitions', { projectId, name: defName });
            const defId = existingDefs[0]?.id || `def-${uuidv4()}`;
            if (!existingDefs[0]) await store.setItem('item-definitions', defId, buildItemDefinition(defId, projectId, mat));

            // 再尝试创建bind关系（需要content中有持有者信息）
            const ownerMatch = mat.content.match(/(?:持有者|使用者|归属|主人|绑定|修炼者)[：:]\s*(.{2,10})/);
            if (!ownerMatch) continue;
            const ownerId = charNameToId[ownerMatch[1].trim()];
            if (!ownerId) continue;

            const bindId = `bind-${uuidv4()}`;
            await store.setItem('character-binds', bindId, buildCharBind(bindId, projectId, ownerId, defId, mat));
        } catch (err) { logger.warn('outlineEquipBinds', '[OUTLINE] Bind failed:', err.message); }  // DEGRADE: 影响=大纲装备绑定写库 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
}

module.exports = { createEquipmentBinds, buildItemDefinition, buildCharBind };
