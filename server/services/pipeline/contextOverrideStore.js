/**
 * contextOverrideStore.js — 用户人工覆盖规则存储
 * 支持章节级、卷级、永久级覆盖
 */
const store = require('../../store');
const { DEPTH_LEVELS } = require('./contextDepthConstants');
const logger = require('../../shared/logger');

const OVERRIDE_STORE_TYPE = 'context-overrides';

/** 覆盖作用域 */
const OVERRIDE_SCOPES = {
    chapter: { label: '章节级', priority: 3 },
    volume:  { label: '卷级',   priority: 2 },
    permanent: { label: '永久级', priority: 1 },
};

/** 获取项目的所有覆盖规则 */
async function getOverrides(projectId) {
    const items = await store.queryItems(OVERRIDE_STORE_TYPE, { projectId });
    return items.sort((a, b) => (b.scopePriority || 0) - (a.scopePriority || 0));
}

/** 获取特定素材的覆盖规则（最高优先级） */
async function getOverrideForMaterial(projectId, materialId, chapterNumber) {
    const overrides = await getOverrides(projectId);
    const matching = overrides.filter(o => o.materialId === materialId);
    if (matching.length === 0) return null;

    const chapterMatch = matching.find(o => o.scope === 'chapter' && o.chapterNumber === chapterNumber);
    if (chapterMatch) return chapterMatch;

    const volumeMatch = matching.find(o => o.scope === 'volume');
    if (volumeMatch) return volumeMatch;

    const permanentMatch = matching.find(o => o.scope === 'permanent');
    if (permanentMatch) return permanentMatch;

    return matching[0];
}

/** 设置覆盖规则 */
async function setOverride(projectId, materialId, override) {
    const { scope, chapterNumber, volumeNumber, targetDepth, enabled } = override;
    if (!DEPTH_LEVELS[targetDepth]) throw new Error(`Invalid depth: ${targetDepth}`);
    if (!OVERRIDE_SCOPES[scope]) throw new Error(`Invalid scope: ${scope}`);

    const existing = await _findExisting(projectId, materialId, scope, chapterNumber);
    const data = {
        projectId,
        materialId,
        scope,
        scopePriority: OVERRIDE_SCOPES[scope].priority,
        chapterNumber: chapterNumber || null,
        volumeNumber: volumeNumber || null,
        targetDepth,
        enabled: enabled !== false,
    };

    if (existing) {
        return await store.updateItem(OVERRIDE_STORE_TYPE, existing.id, data);
    }
    return await store.setItem(OVERRIDE_STORE_TYPE, `${projectId}_${materialId}_${scope}_${chapterNumber || 'all'}`, data);
}

/** 删除覆盖规则 */
async function deleteOverride(overrideId) {
    return await store.deleteItem(OVERRIDE_STORE_TYPE, overrideId);
}

/** 批量获取覆盖（按素材ID映射） */
async function getOverridesMap(projectId, materialIds, chapterNumber) {
    const overrides = await getOverrides(projectId);
    const map = {};
    for (const o of overrides) {
        if (!materialIds.includes(o.materialId)) continue;
        if (!o.enabled) continue;
        if (o.scope === 'chapter' && o.chapterNumber !== chapterNumber) continue;
        if (!map[o.materialId] || (o.scopePriority > (map[o.materialId].scopePriority || 0))) {
            map[o.materialId] = o;
        }
    }
    return map;
}

async function _findExisting(projectId, materialId, scope, chapterNumber) {
    const overrides = await getOverrides(projectId);
    return overrides.find(o =>
        o.materialId === materialId &&
        o.scope === scope &&
        (o.chapterNumber || null) === (chapterNumber || null)
    );
}

module.exports = {
    OVERRIDE_SCOPES,
    getOverrides,
    getOverrideForMaterial,
    setOverride,
    deleteOverride,
    getOverridesMap,
};
