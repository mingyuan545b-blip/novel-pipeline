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

function buildItemDefinition(defId, projectId, mat) {
    const content = mat.content || '';
    return {
        id: defId, projectId, defType: mat.type, name: resolveMaterialName(mat),
        rarity: 'common', briefDesc: content.substring(0, 100),
        summaryDesc: content.substring(0, 300), detailDesc: content,
        loreDesc: '', briefTokens: 50, summaryTokens: 150, detailTokens: Math.ceil(content.length / 2),
        loreTokens: 0, propertiesJson: {}, constraintsJson: {},
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
            // 先创建item-definition（无论是否有持有者信息，定义都必须存在）
            const defId = `def-${uuidv4()}`;
            await store.setItem('item-definitions', defId, buildItemDefinition(defId, projectId, mat));

            // 再尝试创建bind关系（需要content中有持有者信息）
            const ownerMatch = mat.content.match(/(?:持有者|使用者|归属|主人|绑定|修炼者)[：:]\s*(.{2,10})/);
            if (!ownerMatch) continue;
            const ownerId = charNameToId[ownerMatch[1].trim()];
            if (!ownerId) continue;

            const bindId = `bind-${uuidv4()}`;
            await store.setItem('character-binds', bindId, buildCharBind(bindId, projectId, ownerId, defId, mat));
        } catch (err) { logger.warn('outlineEquipBinds', '[OUTLINE] Bind failed:', err.message); }
    }
}

module.exports = { createEquipmentBinds, buildItemDefinition, buildCharBind };
