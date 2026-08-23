// materialRelationSync.js — 关系变更处理实现（自 materialRelationProcessor.js 提取，行为不变）
// 包含：关系类型推断 / 目标实体解析 / 单条关系变更处理 / 秘密关系限知表同步
const store = require('../../../store');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../shared/logger');

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
        const newEntity = await entityCenter.createEntity({
            projectId, entityType: 'character', name: rc.with,
            roleLevel: 'npc', lifecycleState: 'active',
            sourceChapter: chapter.chapterNumber,
            summaryText: `由relationshipChanges自动创建（陷阱#77修复）`,
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
                // 关系类型变化：关闭旧关系，创建新关系（保留时间维度）
                await store.setItem('character-relations', existing.id, {
                    ...existing,
                    endChapter: chapter.chapterNumber,
                    endReason: `关系变为${rc.to || rc.from || relType}`,
                    updatedAt: now
                });
                const newRelId = `rel-${uuidv4()}`;
                await store.setItem('character-relations', newRelId, {
                    id: newRelId, projectId,
                    fromCharacterId: existing.fromCharacterId, toCharacterId: existing.toCharacterId,
                    relType: relType,
                    relLabel: rc.to || rc.from || '',
                    strength: rc.strength || existing.strength,
                    trustLevel: rc.trustLevel || existing.trustLevel,
                    startChapter: chapter.chapterNumber,
                    endChapter: null, isSecret,
                    notes: rc.reason || '',
                    createdAt: now, updatedAt: now
                });
            } else {
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
            operations.push({
                type: 'updateRelationship', scope: 'relationship',
                entityKey: fromId, data: { with: rc.with, to: rc.to, reason: rc.reason },
                status: 'success'
            });
        } else {
            const relId = `rel-${uuidv4()}`;
            await store.setItem('character-relations', relId, {
                id: relId, projectId,
                fromCharacterId: fromId, toCharacterId: toId,
                relType: relType || 'other',
                relLabel: rc.to || rc.from || '',
                strength: rc.strength || 50,
                trustLevel: rc.trustLevel || 50,
                startChapter: chapter.chapterNumber,
                endChapter: null, isSecret,
                notes: rc.reason || '',
                createdAt: now, updatedAt: now
            });
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

module.exports = { REL_TYPE_MAP, inferRelType, syncSecretToKnowledgeAccess, processOneRelationshipChange };
