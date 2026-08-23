/**
 * worldScopeExtractRunner.js — LLM提取+存储执行器
 *
 * 职责：调用worldScopeExtractor提取章节内容，将结果写入world-scopes/world-factions/cross-world-traces表
 * 从worldScopeModule.js拆分，保持re-export完整（陷阱#1）
 */
const logger = require('../shared/logger');
const store = require('../store');
const { setWorldFaction } = require('./worldFactionModule');

async function extractAndSave(projectId, chapterNumber, chapterContent, level) {
    const { extractWorldScopeFromChapter } = require('./worldScopeExtractor');
    const result = await extractWorldScopeFromChapter(projectId, chapterNumber, chapterContent, level);

    const now = new Date().toISOString();
    const entities = Array.isArray(result.entities) ? result.entities : [];
    const transitions = Array.isArray(result.transitions) ? result.transitions : [];
    const worldInfos = Array.isArray(result.worldInfos) ? result.worldInfos : [];
    const factions = Array.isArray(result.factions) ? result.factions : [];
    const crossWorldItems = Array.isArray(result.crossWorldItems) ? result.crossWorldItems : [];

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

    logger.info('worldScope', `extractAndSave ch${chapterNumber}: ${entities.length} entities, ${transitions.length} transitions, ${worldInfos.length} worlds, ${factions.length} factions, ${crossWorldItems.length} crossItems`);
    return result;
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
            transitionChapter: item.transitionChapter || chapterNumber
        }));
        const traceResults = await batchCreateTraces(projectId, tracePayloads);
        const okCount = traceResults.filter(r => r.success).length;
        logger.info('worldScope', `extractAndSave ch${chapterNumber}: cross-world traces ${okCount}/${crossWorldItems.length} saved`);
    } catch (e) {
        logger.warn('worldScope', `Failed to batch save cross-world traces: ${e.message}`);
    }
}

module.exports = { extractAndSave };
