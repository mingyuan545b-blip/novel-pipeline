/**
 * materialRelationWriter.js — 角色关系行写入（三键去重）
 * 自 materialRelationSync.js 拆出（维持单文件≤200行硬限制）。
 *
 * 根因（2026-10-10）：关系类型用"关闭旧行 + 插入新行"做时间维度，但唯一索引
 * idx_rel_unique(fromCharacterId,toCharacterId,relType) 不含时间维度；关系一旦摆动回
 * 曾用过的类型（信任→敌对→信任），新建行会撞唯一约束 → store-pg 抛错 → 素材登记报错。
 * 写入前用 findExactRel 探测并"复活"旧行，而非新建。
 */
const store = require('../../../store');
const { v4: uuidv4 } = require('uuid');

/** 精确三键 (from,to,relType) 匹配——与唯一索引 idx_rel_unique 对齐 */
function findExactRel(rels, fromId, toId, relType) {
    return rels.find(r =>
        r.fromCharacterId === fromId &&
        r.toCharacterId === toId &&
        (r.relType || 'other') === (relType || 'other')
    ) || null;
}

function _newRow(projectId, fromCharacterId, toCharacterId, relType, rc, chapter, isSecret, now) {
    return {
        id: `rel-${uuidv4()}`, projectId,
        fromCharacterId, toCharacterId, relType,
        relLabel: rc.to || rc.from || '',
        strength: rc.strength || 50,
        trustLevel: rc.trustLevel || 50,
        startChapter: chapter.chapterNumber,
        endChapter: null, isSecret,
        notes: rc.reason || '',
        createdAt: now, updatedAt: now
    };
}

/** 关系类型变化：关闭旧行 + 写新类型行（同键已存在则复活旧行，不新建） */
async function writeRetypedRelation({ projectId, existing, existingRels, relType, rc, chapter, isSecret, now }) {
    await store.setItem('character-relations', existing.id, {
        ...existing,
        endChapter: chapter.chapterNumber,
        endReason: `关系变为${rc.to || rc.from || relType}`,
        updatedAt: now
    });
    const dup = findExactRel(existingRels, existing.fromCharacterId, existing.toCharacterId, relType);
    if (dup) {
        await store.setItem('character-relations', dup.id, {
            ...dup, endChapter: null,
            strength: rc.strength || dup.strength,
            trustLevel: rc.trustLevel || dup.trustLevel,
            isSecret, notes: rc.reason || dup.notes || '', updatedAt: now
        });
        return dup.id;
    }
    const row = _newRow(projectId, existing.fromCharacterId, existing.toCharacterId, relType, rc, chapter, isSecret, now);
    await store.setItem('character-relations', row.id, row);
    return row.id;
}

/** 同类型关系刷新（强度/信任/秘密/备注） */
async function refreshRelation({ existing, relType, rc, isSecret, now }) {
    await store.setItem('character-relations', existing.id, {
        ...existing,
        relType: relType || existing.relType,
        relLabel: rc.to || rc.from || existing.relLabel || '',
        strength: rc.strength || existing.strength,
        trustLevel: rc.trustLevel || existing.trustLevel,
        isSecret: isSecret || existing.isSecret,
        notes: rc.reason || existing.notes || '',
        updatedAt: now
    });
}

/** 新建关系行（当前无该对角色任何关系） */
async function createRelation({ projectId, fromId, toId, relType, rc, chapter, isSecret, now }) {
    const row = _newRow(projectId, fromId, toId, relType || 'other', rc, chapter, isSecret, now);
    await store.setItem('character-relations', row.id, row);
    return row.id;
}

module.exports = { findExactRel, writeRetypedRelation, refreshRelation, createRelation };
