/**
 * knowledgeExtractor.js — 从materialOrganizer输出中提取限知认知变化
 * 章节审批通过后自动执行，将knowledgeChanges写入knowledge_access表
 * factId关联knowledge-facts记录，实现事实×角色稀疏矩阵
 */
const logger = require('../../../shared/logger');

/**
 * 处理organizingPlan中的knowledgeChanges
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {object|null} organizingPlan
 * @returns {Promise<{created: number, errors: number, factsCreated: number}>}
 */
async function processKnowledgeChanges(projectId, chapterNumber, organizingPlan) {
    if (!organizingPlan || !organizingPlan.knowledgeChanges) {
        return { created: 0, errors: 0, factsCreated: 0 };
    }

    const knowledgeAccess = require('../../knowledgeBase/knowledgeAccess');
    const { findOrCreateFact } = require('../../knowledgeBase/factLookup');
    const entityCenter = require('../../entityCenter');
    const changes = organizingPlan.knowledgeChanges;

    if (!Array.isArray(changes) || changes.length === 0) {
        return { created: 0, errors: 0, factsCreated: 0 };
    }

    // 构建角色名→ID映射
    const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
    const nameToId = new Map();
    for (const e of entities) nameToId.set(e.name, e.id);

    let created = 0;
    let errors = 0;
    let factsCreated = 0;

    for (const kc of changes) {
        if (!kc.factId || !kc.entityName) continue;

        const entityId = nameToId.get(kc.entityName) || kc.entityName;
        try {
            // 将factId(文本)关联到knowledge-facts记录
            const factResult = await findOrCreateFact(projectId, kc.factId, {
                level: 'L2',
                category: 'knowledge-access',
                chapterNumber,
                importance: 50,
            });
            if (factResult.isNew) factsCreated++;

            await knowledgeAccess.upsertAccess(projectId, factResult.id, entityId, {
                factText: factResult.factText,
                confidence: kc.confidence || 'certain',
                sourceHow: kc.sourceHow || 'witnessed',
                sinceChapter: chapterNumber,
                notes: kc.notes || '',
            });
            created++;
        } catch (e) {
            errors++;
            logger.warn('knowledgeExtractor', `Failed: fact=${kc.factId} entity=${kc.entityName}: ${e.message}`);
        }
    }

    logger.info('knowledgeExtractor', `Ch${chapterNumber}: ${created} access records, ${factsCreated} new facts, ${errors} errors`);
    return { created, errors, factsCreated };
}

module.exports = { processKnowledgeChanges };
