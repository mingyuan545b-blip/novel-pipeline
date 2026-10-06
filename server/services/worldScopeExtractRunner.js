/**
 * worldScopeExtractRunner.js — LLM提取+存储执行器
 *
 * 职责：调用worldScopeExtractor提取章节内容，将结果写入world-scopes/world-factions/cross-world-traces表
 * 从worldScopeModule.js拆分，保持re-export完整（陷阱#1）
 */
const logger = require('../shared/logger');
const store = require('../store');
const { setWorldFaction } = require('./worldFactionModule');
const { getProjectWorlds } = require('./worldScopeCrud');
const { detectCarryOutViolation } = require('./carryOutGate');
const { normalizeWorldRefs } = require('./worldRefResolve');

async function extractAndSave(projectId, chapterNumber, chapterContent, level) {
    const { extractWorldScopeFromChapter } = require('./worldScopeExtractor');
    const result = await extractWorldScopeFromChapter(projectId, chapterNumber, chapterContent, level);

    // #17：LLM 常把副本名配上 worldId=main-world → 落库前按项目配置 name→id 归一
    try {
        const worlds = await getProjectWorlds(projectId);
        normalizeWorldRefs(result, worlds);
    } catch (e) {
        logger.warn('worldScope', `worldRef normalization skipped: ${e.message}`);
    }

    const now = new Date().toISOString();
    const entities = Array.isArray(result.entities) ? result.entities : [];
    const transitions = Array.isArray(result.transitions) ? result.transitions : [];
    const worldInfos = Array.isArray(result.worldInfos) ? result.worldInfos : [];
    const factions = Array.isArray(result.factions) ? result.factions : [];
    const crossWorldItems = Array.isArray(result.crossWorldItems) ? result.crossWorldItems : [];

    // 0. 软门禁：跨副本带出缺渠道标签 → 记违规（不阻断，先可见）
    const violations = await _detectAndStoreViolations(projectId, chapterNumber, transitions, crossWorldItems, now);

    // 1. 存储实体归属
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const id = `ws-${projectId}-ch${chapterNumber}-e${i}`;
        await store.setItem('world-scopes', id, {
            id, projectId,
            type: 'entity-scope',
            name: entity.name || 'unknown',
            entityType: entity.entityType || 'character',
            worldId: entity.worldId || 'main-world',
            worldName: entity.worldName || '主世界',
            locationSlot: entity.locationSlot || '',
            isVisitor: entity.isVisitor || false,
            chapterNumber,
            createdAt: now, updatedAt: now
        });
    }

    // 2. 存储穿越事件
    for (let i = 0; i < transitions.length; i++) {
        const trans = transitions[i];
        const id = `ws-${projectId}-ch${chapterNumber}-t${i}`;
        await store.setItem('world-scopes', id, {
            id, projectId,
            type: 'transition',
            character: trans.character || 'unknown',
            fromWorld: trans.from || '',
            toWorld: trans.to || '',
            channel: trans.channel || '',
            medium: trans.medium || '',
            chapterNumber,
            createdAt: now, updatedAt: now
        });
    }

    // 3. 存储世界属性
    for (let i = 0; i < worldInfos.length; i++) {
        const w = worldInfos[i];
        const id = `ws-${projectId}-ch${chapterNumber}-w-${w.worldId || 'main-world'}`;
        await store.setItem('world-scopes', id, {
            id, projectId, type: 'world-info',
            worldId: w.worldId || 'main-world',
            worldName: w.worldName || '主世界',
            worldType: w.worldType || 'main',
            powerSystem: Array.isArray(w.powerSystem) ? w.powerSystem : [],
            culture: w.culture || '',
            techLevel: w.techLevel || 'med',
            rules: w.rules || '',
            dangerLevel: w.dangerLevel || 'low',
            entryMethod: w.entryMethod || '',
            exitMethod: w.exitMethod || '',
            carryOutPolicy: w.carryOutPolicy || 'native',
            channelTag: w.channelTag || '',
            description: w.description || '',
            chapterNumber,
            createdAt: now, updatedAt: now
        });
    }

    // 4. 存储势力
    for (let i = 0; i < factions.length; i++) {
        const f = factions[i];
        if (!f.name) continue;
        try {
            await setWorldFaction(projectId, f.worldId || 'main-world', {
                name: f.name,
                type: f.type || 'cultivation',
                status: f.status || 'active',
                leader: f.leader || '',
                description: f.description || ''
            });
        } catch (e) {
            logger.warn('worldScope', `Failed to save faction ${f.name}: ${e.message}`);
        }
    }

    // 5. 存储跨世界物品溯源
    await _saveCrossWorldTraces(projectId, chapterNumber, crossWorldItems);

    logger.info('worldScope', `extractAndSave ch${chapterNumber}: ${entities.length} entities, ${transitions.length} transitions, ${worldInfos.length} worlds, ${factions.length} factions, ${crossWorldItems.length} crossItems, ${violations.length} violations`);
    result.crossWorldViolations = [
        ...(Array.isArray(result.crossWorldViolations) ? result.crossWorldViolations : []),
        ...violations
    ];
    return result;
}

/** 软门禁：检测跨副本带出缺渠道标签并落库（私有） */
async function _detectAndStoreViolations(projectId, chapterNumber, transitions, crossWorldItems, now) {
    let worlds = [];
    try { worlds = await getProjectWorlds(projectId); } catch (e) { logger.warn('worldScope', `load worlds failed: ${e.message}`); }
    const candidates = [
        ...transitions.map(t => ({ character: t.character, from: t.from, to: t.to, channel: t.channel })),
        ...crossWorldItems.map(it => ({ entityName: it.entityName, from: it.transitionFrom, to: it.transitionTo, channel: it.transitionChannel }))
    ];
    const violations = [];
    for (let i = 0; i < candidates.length; i++) {
        const v = detectCarryOutViolation(worlds, candidates[i]);
        if (!v) continue;
        violations.push(v);
        const id = `ws-${projectId}-ch${chapterNumber}-v${i}`;
        await store.setItem('world-scopes', id, {
            id, projectId, type: 'transition-violation', ...v, chapterNumber, createdAt: now, updatedAt: now
        });
    }
    return violations;
}

/** 存储跨世界物品溯源（私有） */
async function _saveCrossWorldTraces(projectId, chapterNumber, crossWorldItems) {
    if (crossWorldItems.length === 0) return;
    const { batchCreateTraces } = require('./crossWorldTraceModule');
    try {
        const tracePayloads = crossWorldItems.map(item => ({
            entityId: item.entityId || `entity-${item.entityName}-${chapterNumber}`,
            entityName: item.entityName,
            entityType: item.entityType || 'equipment',
            characterId: item.characterId || '',
            characterName: item.characterName || '',
            originWorldId: item.originWorldId || 'main-world',
            originWorldName: item.originWorldName || '主世界',
            originChapter: item.originChapter || chapterNumber,
            originMethod: item.originMethod || 'picked',
            originNote: item.originNote || '',
            transitionFrom: item.transitionFrom || '',
            transitionTo: item.transitionTo || '',
            transitionNote: item.transitionNote || '',
            transitionChapter: item.transitionChapter || chapterNumber,
            transitionChannel: item.transitionChannel || '',
            transitionMedium: item.transitionMedium || ''
        }));
        const traceResults = await batchCreateTraces(projectId, tracePayloads);
        const okCount = traceResults.filter(r => r.success).length;
        logger.info('worldScope', `extractAndSave ch${chapterNumber}: cross-world traces ${okCount}/${crossWorldItems.length} saved`);
    } catch (e) {
        logger.warn('worldScope', `Failed to batch save cross-world traces: ${e.message}`);
    }
}

module.exports = { extractAndSave };
