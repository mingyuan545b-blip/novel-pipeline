/**
 * knowledgeAccess.js — 限知认知访问CRUD服务
 * 记录"哪个角色知道哪个事实/事件/关系真相"
 * 三维度：信息维度(factId) × 认知维度(entityId) × 置信维度(confidence)
 */
const store = require('../../store');
const { v4: uuidv4 } = require('uuid');

const STORE_TYPE = 'knowledge-access';

const CONFIDENCE_LEVELS = ['certain', 'suspect', 'misinformed', 'unknown'];
const SOURCE_HOW_TYPES = ['witnessed', 'told', 'inferred', 'discovered'];

/** 查询项目的所有限知记录 */
async function getAccessByProject(projectId, options = {}) {
    return store.queryItems(STORE_TYPE, { projectId, ...options });
}

/** 查询某个事实被哪些角色知晓 */
async function getAccessByFact(projectId, factId) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    return all.filter(a => a.factId === factId);
}

/** 查询某个角色知道哪些事实 */
async function getAccessByEntity(projectId, entityId) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    return all.filter(a => a.entityId === entityId);
}

/** 批量查询多个角色的限知记录（Agent调度器用） */
async function getAccessByEntities(projectId, entityIds) {
    if (!entityIds || entityIds.length === 0) return [];
    const all = await store.queryItems(STORE_TYPE, { projectId });
    const idSet = new Set(entityIds);
    return all.filter(a => idSet.has(a.entityId));
}

/** 创建或更新限知记录（factId+entityId唯一约束） */
async function upsertAccess(projectId, factId, entityId, data = {}) {
    if (!projectId || !factId || !entityId) {
        throw new Error('projectId, factId, entityId are required');
    }
    const confidence = data.confidence || 'certain';
    if (!CONFIDENCE_LEVELS.includes(confidence)) {
        throw new Error(`Invalid confidence: ${confidence}. Must be one of: ${CONFIDENCE_LEVELS.join(', ')}`);
    }
    const existing = await _findByFactAndEntity(projectId, factId, entityId);
    const now = new Date().toISOString();

    if (existing) {
        const updated = {
            ...existing,
            confidence,
            sourceHow: data.sourceHow || existing.sourceHow || '',
            sinceChapter: data.sinceChapter ?? existing.sinceChapter ?? 0,
            factText: data.factText || existing.factText || '',
            notes: data.notes ?? existing.notes ?? '',
            updatedAt: now,
        };
        await store.setItem(STORE_TYPE, existing.id, updated);
        return updated;
    }

    const id = `ka-${uuidv4()}`;
    const record = {
        id, projectId, factId, entityId,
        factText: data.factText || '',
        confidence,
        sourceHow: data.sourceHow || '',
        sinceChapter: data.sinceChapter ?? 0,
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
    };
    await store.setItem(STORE_TYPE, id, record);
    return record;
}

/** 批量创建限知记录（章节后处理用） */
async function batchUpsertAccess(projectId, records) {
    const results = [];
    for (const r of records) {
        try {
            const result = await upsertAccess(projectId, r.factId, r.entityId, r);
            results.push(result);
        } catch (e) {
            results.push({ error: e.message, factId: r.factId, entityId: r.entityId });
        }
    }
    return results;
}

/** 删除单条限知记录 */
async function deleteAccess(id) {
    return await store.deleteItem(STORE_TYPE, id);
}

/** 删除项目所有限知记录（级联删除用） */
async function deleteAccessByProject(projectId) {
    const items = await store.queryItems(STORE_TYPE, { projectId });
    for (const item of items) {
        await store.deleteItem(STORE_TYPE, item.id);
    }
    return items.length;
}

/** 格式化限知数据为Writer prompt文本 */
function formatAccessForPrompt(accessRecords, entityNames = {}) {
    if (!accessRecords || accessRecords.length === 0) return '';

    const byEntity = new Map();
    for (const a of accessRecords) {
        const name = entityNames[a.entityId] || a.entityId;
        if (!byEntity.has(name)) byEntity.set(name, []);
        byEntity.get(name).push(a);
    }

    const lines = [];
    for (const [name, records] of byEntity) {
        const facts = records.map(r => {
            const conf = _confidenceLabel(r.confidence);
            const source = r.sourceHow ? `(${_sourceHowLabel(r.sourceHow)})` : '';
            const display = r.factText || r.factId;
            return `  - ${display} ${conf}${source}`;
        });
        lines.push(`${name}：\n${facts.join('\n')}`);
    }
    return lines.join('\n');
}

async function _findByFactAndEntity(projectId, factId, entityId) {
    try {
        const byFact = await getAccessByFact(projectId, factId);
        return byFact.find(a => a.entityId === entityId) || null;
    } catch (_) {
        const all = await store.queryItems(STORE_TYPE, { projectId });
        return all.find(a => a.factId === factId && a.entityId === entityId) || null;
    }
}

function _confidenceLabel(c) {
    const map = { certain: '[确信]', suspect: '[怀疑]', misinformed: '[误信]', unknown: '[未知]' };
    return map[c] || '[未知]';
}

function _sourceHowLabel(s) {
    const map = { witnessed: '亲眼', told: '听说', inferred: '推理', discovered: '发现' };
    return map[s] || s;
}

module.exports = {
    CONFIDENCE_LEVELS, SOURCE_HOW_TYPES, STORE_TYPE,
    getAccessByProject, getAccessByFact, getAccessByEntity,
    getAccessByEntities, upsertAccess, batchUpsertAccess,
    deleteAccess, deleteAccessByProject, formatAccessForPrompt,
};
