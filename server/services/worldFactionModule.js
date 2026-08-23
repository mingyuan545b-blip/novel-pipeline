/**
 * worldFactionModule.js — 世界势力CRUD
 *
 * 职责：world-factions表的增删改查 + 批量覆盖
 * 从worldScopeModule.js拆分，保持re-export完整（陷阱#1）
 */
const logger = require('../shared/logger');
const store = require('../store');

/** 势力表名 */
const FACTIONS_TABLE = 'world-factions';

/** 新增/更新世界势力 */
async function setWorldFaction(projectId, worldId, faction) {
    const id = faction.id || `wf-${projectId}-${worldId}-${Date.now()}`;
    const record = {
        id, projectId, worldId,
        name: faction.name || '未命名势力',
        type: faction.type || 'cultivation',
        status: faction.status || 'active',
        leader: faction.leader || '',
        description: faction.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await store.setItem(FACTIONS_TABLE, id, record);
    return record;
}

/** 查询某世界的所有势力 */
async function getWorldFactions(projectId, worldId) {
    const all = await store.queryItems(FACTIONS_TABLE, { projectId });
    if (!all) return [];
    return worldId ? all.filter(f => f.worldId === worldId) : all;
}

/** 删除势力 */
async function removeWorldFaction(projectId, factionId) {
    await store.deleteItem(FACTIONS_TABLE, factionId);
    return { success: true };
}

/** 批量设置某世界的势力（覆盖模式） */
async function batchSetWorldFactions(projectId, worldId, factions) {
    const old = await getWorldFactions(projectId, worldId);
    for (const f of old) {
        await store.deleteItem(FACTIONS_TABLE, f.id);
    }
    const results = [];
    for (const f of factions) {
        try {
            results.push(await setWorldFaction(projectId, worldId, f));
        } catch (e) {
            logger.warn('worldScope', `Failed to set faction ${f.name}: ${e.message}`);
        }
    }
    return results;
}

module.exports = {
    FACTIONS_TABLE,
    setWorldFaction, getWorldFactions, removeWorldFaction, batchSetWorldFactions
};
