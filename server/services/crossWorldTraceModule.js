/**
 * crossWorldTraceModule — 跨世界物品溯源CRUD模块
 *
 * 表名：cross-world-traces (PG: cross_world_traces)
 * 用途：记录主角从小世界获取的装备/功法/法宝带往主世界的完整溯源轨迹
 */
const logger = require('../shared/logger');
const store = require('../store');
const { buildTrace, validateTrace, appendTraceEvent } = require('./crossWorldTraceConstants');

const TRACE_TABLE = 'cross-world-traces';

/** 查询项目的所有溯源记录 */
async function getTracesByProject(projectId, filters = {}) {
    const all = await store.queryItems(TRACE_TABLE, { projectId });
    if (!all) return [];
    let list = all;
    if (filters.characterId) list = list.filter(t => t.characterId === filters.characterId);
    if (filters.entityId) list = list.filter(t => t.entityId === filters.entityId);
    if (filters.originWorldId) list = list.filter(t => t.originWorldId === filters.originWorldId);
    if (filters.currentWorldId) list = list.filter(t => t.currentWorldId === filters.currentWorldId);
    if (filters.entityType) list = list.filter(t => t.entityType === filters.entityType);
    return list.sort((a, b) => (a.originChapter || 0) - (b.originChapter || 0));
}

/** 查询单条溯源记录 */
async function getTrace(projectId, traceId) {
    return await store.getItem(TRACE_TABLE, traceId);
}

/** 按实体ID查询溯源（一个物品可能有多角色持有历史） */
async function getTracesByEntity(projectId, entityId) {
    const all = await store.queryItems(TRACE_TABLE, { projectId });
    return (all || []).filter(t => t.entityId === entityId);
}

/** 创建溯源记录（首次获取） */
async function createTrace(projectId, payload) {
    const id = payload.id || `cwt-${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // 若未提供entityId，基于entityName+originChapter生成稳定ID
    const entityId = payload.entityId || `entity-${Buffer.from(payload.entityName || 'unknown').toString('hex').slice(0, 12)}-ch${payload.originChapter || 0}`;
    const trace = buildTrace({
        id,
        projectId,
        entityId,
        entityName: payload.entityName,
        entityType: payload.entityType || 'equipment',
        characterId: payload.characterId || '',
        characterName: payload.characterName || '',
        originWorldId: payload.originWorldId || 'main-world',
        originWorldName: payload.originWorldName || '主世界',
        originChapter: payload.originChapter || 0,
        originMethod: payload.originMethod || 'picked',
        currentWorldId: payload.originWorldId || 'main-world',
        currentWorldName: payload.originWorldName || '主世界'
    });
    // 初始轨迹事件：获取
    appendTraceEvent(trace, {
        chapter: trace.originChapter,
        fromWorld: '',
        toWorld: trace.originWorldId,
        action: 'acquired',
        note: `在${trace.originWorldName}获取(${payload.originNote || ''})`
    });
    const errors = validateTrace(trace);
    if (errors.length > 0) {
        throw new Error(`溯源记录校验失败: ${errors.join('; ')}`);
    }
    await store.setItem(TRACE_TABLE, id, trace);
    logger.info('crossWorldTrace', `Created trace ${id} for entity ${trace.entityId}`);
    return trace;
}

/** 追加跨世界事件（如：从小世界带回主世界） */
async function addTraceEvent(projectId, traceId, event) {
    const existing = await store.getItem(TRACE_TABLE, traceId);
    if (!existing) throw new Error(`溯源记录不存在: ${traceId}`);
    appendTraceEvent(existing, event);
    // 同步currentWorldName
    if (event.toWorld && event.toWorldName) {
        existing.currentWorldName = event.toWorldName;
    }
    await store.setItem(TRACE_TABLE, traceId, existing);
    return existing;
}

/** 更新溯源基本信息 */
async function updateTrace(projectId, traceId, patch) {
    const existing = await store.getItem(TRACE_TABLE, traceId);
    if (!existing) throw new Error(`溯源记录不存在: ${traceId}`);
    const updated = { ...existing, ...patch, id: traceId, projectId, updatedAt: new Date().toISOString() };
    const errors = validateTrace(updated);
    if (errors.length > 0) {
        throw new Error(`溯源记录校验失败: ${errors.join('; ')}`);
    }
    await store.setItem(TRACE_TABLE, traceId, updated);
    return updated;
}

/** 删除溯源记录 */
async function deleteTrace(projectId, traceId) {
    await store.deleteItem(TRACE_TABLE, traceId);
    return { success: true };
}

/** 批量创建溯源（LLM提取后批量入库） */
async function batchCreateTraces(projectId, traces) {
    const results = [];
    for (const t of traces) {
        try {
            // 同实体同角色已存在则跳过(避免重复)
            const existing = await getTracesByEntity(projectId, t.entityId);
            const dup = existing.find(e => e.characterId === (t.characterId || ''));
            if (dup) {
                // 已存在，若发生跨世界则追加事件
                if (t.transitionFrom && t.transitionTo && t.transitionFrom !== dup.currentWorldId) {
                    await addTraceEvent(projectId, dup.id, {
                        chapter: t.originChapter,
                        fromWorld: t.transitionFrom,
                        toWorld: t.transitionTo,
                        action: 'transitioned',
                        note: t.transitionNote || ''
                    });
                    results.push({ entityId: t.entityId, success: true, action: 'transition_appended' });
                } else {
                    results.push({ entityId: t.entityId, success: true, action: 'duplicate_skipped' });
                }
            } else {
                const created = await createTrace(projectId, t);
                // 若创建时已是跨世界获取，追加一次transitioned事件
                if (t.transitionFrom && t.transitionTo && t.transitionFrom !== t.originWorldId) {
                    await addTraceEvent(projectId, created.id, {
                        chapter: t.transitionChapter || t.originChapter,
                        fromWorld: t.transitionFrom,
                        toWorld: t.transitionTo,
                        action: 'transitioned',
                        note: t.transitionNote || '带回主世界'
                    });
                }
                results.push({ entityId: t.entityId, success: true, action: 'created', traceId: created.id });
            }
        } catch (e) {
            logger.warn('crossWorldTrace', `batchCreate entity ${t.entityId} failed: ${e.message}`);
            results.push({ entityId: t.entityId, success: false, error: e.message });
        }
    }
    return results;
}

module.exports = {
    TRACE_TABLE,
    getTracesByProject,
    getTrace,
    getTracesByEntity,
    createTrace,
    addTraceEvent,
    updateTrace,
    deleteTrace,
    batchCreateTraces
};
