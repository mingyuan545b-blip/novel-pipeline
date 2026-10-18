// materialRelationSync.js — 关系变更处理实现（自 materialRelationProcessor.js 提取，行为不变）
// 包含：关系类型推断 / 目标实体解析 / 单条关系变更处理 / 秘密关系限知表同步
const store = require('../../../store');
const logger = require('../../../shared/logger');
const { findExactRel, writeRetypedRelation, refreshRelation, createRelation } = require('./materialRelationWriter');

const REL_TYPE_MAP = {
    '信任': 'ally', '友好': 'ally', '盟友': 'ally', '朋友': 'ally', '亲密': 'ally',
    '敌对': 'enemy', '仇恨': 'enemy', '对手': 'rival', '竞争': 'rival',
    '师徒': 'mentor', '师': 'mentor', '徒': 'mentor',
    '恋人': 'romantic', '爱': 'romantic', '情侣': 'romantic',
    '家人': 'family', '亲': 'family', '兄弟': 'family', '姐妹': 'family',
    '陌生': 'neutral', '认识': 'acquaintance', '同门': 'ally',
};

function inferRelType(label) {
    if (!label || typeof label !== 'string') return 'other';
    for (const [keyword, type] of Object.entries(REL_TYPE_MAP)) {
        if (label.includes(keyword)) return type;
    }
    return 'other';
}

/**
 * 精确三键匹配 (fromCharacterId, toCharacterId, relType)——与唯一索引 idx_rel_unique 对齐。
 * 实现与写入逻辑见 materialRelationWriter.js（本文件保持≤200行）。
 */

/** 秘密关系同步到限知表：关系双方确信，其他人未知 */
async function syncSecretToKnowledgeAccess(projectId, fromId, toId, rc, chapter) {
    try {
        const knowledgeAccess = require('../../../services/knowledgeBase/knowledgeAccess');
        const { findOrCreateFact } = require('../../../services/knowledgeBase/factLookup');
        const factText = `秘密关系：${rc.to || rc.from || ''}`;
        const chapterNum = chapter?.chapterNumber || 0;

        // 创建/查找knowledge-facts记录
        const factResult = await findOrCreateFact(projectId, factText, {
            level: 'L1',
            category: 'secret-relation',
            chapterNumber: chapterNum,
            importance: 70,
        });

        // 关系双方确信知道这个秘密关系
        await knowledgeAccess.upsertAccess(projectId, factResult.id, fromId, {
            factText: factResult.factText,
            confidence: 'certain',
            sourceHow: 'witnessed',
            sinceChapter: chapterNum,
            notes: factText,
        });
        await knowledgeAccess.upsertAccess(projectId, factResult.id, toId, {
            factText: factResult.factText,
            confidence: 'certain',
            sourceHow: 'witnessed',
            sinceChapter: chapterNum,
            notes: factText,
        });

        // 如果rc.knownBy指定了其他知情者，也同步
        if (Array.isArray(rc.knownBy)) {
            for (const knownEntityId of rc.knownBy) {
                await knowledgeAccess.upsertAccess(projectId, factResult.id, knownEntityId, {
                    factText: factResult.factText,
                    confidence: 'certain',
                    sourceHow: 'told',
                    sinceChapter: chapterNum,
                    notes: `被告知秘密关系`,
                });
            }
        }
    } catch (e) {
        logger.warn('materialRelationSync', `Failed to sync secret to knowledge_access: ${e.message}`);
    }
}

/**
 * 解析关系目标实体ID：优先materials表 → entityCenter → 自动创建最小实体（陷阱#77）
 * @returns {Promise<string|null>} toId；自动创建失败时返回null
 */
async function resolveRelationTargetId(rc, ctx) {
    const { projectId, chapter, materials, errors } = ctx;
    const toMat = materials.find(m =>
        m.projectId === projectId && m.type === 'character' && !m.archived && m.name === rc.with
    );
    if (toMat) return toMat.id;

    try {
        const entityCenter = require('../../entityCenter');
        const entity = await entityCenter.findEntityByName(projectId, 'character', rc.with);
        if (entity) return entity.id;
    } catch (_) { /* entityCenter查找失败，继续到自动创建 */ }

    // 陷阱#77修复：自动创建最小实体，避免引用的角色永远不被创建
    logger.warn('materialRelationSync', `[trap#77] Auto-creating missing character entity: "${rc.with}"`);
    try {
        const entityCenter = require('../../entityCenter');
        const newEntity = await entityCenter.getOrCreateEntity(projectId, 'character', rc.with, {
            roleLevel: 'npc', lifecycleState: 'active',
            sourceChapter: chapter.chapterNumber,
        });
        return newEntity.id;
    } catch (createErr) {
        errors.push(`Auto-create failed for relationship target "${rc.with}": ${createErr.message}`);
        return null;
    }
}

/**
 * 处理单条关系变更（自 processRelationshipChanges 循环体提取，行为不变）
 * @param {object} rc 单条relationshipChange
 * @param {object} ctx { fromId, chapter, projectId, materials, operations, errors, charName }
 */
async function processOneRelationshipChange(rc, ctx) {
    const { fromId, chapter, projectId, operations, errors, charName } = ctx;
    if (!rc.with) return;
    try {
        // 陷阱#77：目标实体解析（materials表 → entityCenter → 自动创建）
        const toId = await resolveRelationTargetId(rc, ctx);
        if (!toId) return;

        const existingRels = await store.queryItems('character-relations', { projectId });
        const existing = existingRels.find(r =>
            (r.fromCharacterId === fromId && r.toCharacterId === toId) ||
            (r.fromCharacterId === toId && r.toCharacterId === fromId)
        );

        const relType = inferRelType(rc.to || rc.from || '');
        const now = new Date().toISOString();
        const isSecret = rc.isSecret === true;

        if (existing) {
            if (relType && relType !== existing.relType) {
                // 关系类型变化：关闭旧行 + 写新类型行（同键已存在则复活旧行，见 materialRelationWriter）
                await writeRetypedRelation({ projectId, existing, existingRels, relType, rc, chapter, isSecret, now });
            } else {
                await refreshRelation({ existing, relType, rc, isSecret, now });
            }
            operations.push({
                type: 'updateRelationship', scope: 'relationship',
                entityKey: fromId, data: { with: rc.with, to: rc.to, reason: rc.reason },
                status: 'success'
            });
        } else {
            await createRelation({ projectId, fromId, toId, relType, rc, chapter, isSecret, now });
            operations.push({
                type: 'createRelationship', scope: 'relationship',
                entityKey: fromId, data: { with: rc.with, to: rc.to, reason: rc.reason },
                status: 'success'
            });
        }

        // isSecret关系同步到knowledge_access限知表
        if (isSecret) {
            await syncSecretToKnowledgeAccess(projectId, fromId, toId, rc, chapter);
        }
    } catch (relErr) {
        errors.push(`Failed to process relationship for ${charName}→${rc.with}: ${relErr.message}`);
    }
}

module.exports = { REL_TYPE_MAP, inferRelType, findExactRel, syncSecretToKnowledgeAccess, processOneRelationshipChange };
