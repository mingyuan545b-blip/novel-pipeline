/**
 * contractMaterialEnricher.js — 契约校验素材数据源统一器
 *
 * 陷阱#79根因修复：数据源不统一
 * - writer 通过 buildStateJson(entity, projectId) 合并 entity + KV store，能拿到深度字段
 * - 契约校验此前读 ctx.materials[].stateJson（materials 表原始字段），深度字段为空
 * - 导致 CH2+ 契约校验误判阻断，即使 writer 实际能拿到深度字段
 *
 * 修复：契约校验前，对 character 素材合并 KV store 深度字段，与 writer 数据源一致
 */
const logger = require('../../shared/logger');
const { buildStateJson } = require('./agentMaterialHelpers');
const entityCenter = require('../entityCenter');
const { backfillDepthKeys } = require('./materialDepthBackfill');

/**
 * 为契约校验丰富素材数据：对 character 素材合并 KV store 深度字段
 * @param {Array} materials - 原始素材列表（来自 materials 表）
 * @param {string} projectId
 * @returns {Promise<Array>} 丰富后的素材列表（character.stateJson 含 KV store 深度字段）
 */
async function enrichMaterialsForContract(materials, projectId) {
    if (!Array.isArray(materials) || materials.length === 0) return materials;

    const charMats = materials.filter(m => m.type === 'character' && !m.archived);
    if (charMats.length === 0) return materials;

    // 获取实体中心的角色（buildStateJson 需要 entity.id）
    let entities = [];
    try {
        entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
    } catch (e) {
        logger.warn('contractEnricher', `Failed to load entities for contract enrichment: ${e.message}`);
        return materials;
    }

    // 构建 name → entity 映射
    const entityByName = {};
    for (const e of entities) {
        entityByName[e.name] = e;
    }

    // 对每个未归档角色素材，合并 KV store 深度字段
    const enriched = [];
    for (const m of materials) {
        if (m.type !== 'character' || m.archived) {
            enriched.push(m);
            continue;
        }

        const entity = entityByName[m.name] || entityByName[m.name?.trim()];
        if (!entity) {
            enriched.push(m);
            continue;
        }

        try {
            const mergedStateJson = await buildStateJson(entity, projectId);
            // T6：深度键多来源确定性回填（实体/KV → 素材正文【标签】）
            // 只在缺失时填补，绝不覆盖；没有真实来源就不产生键（不臆造）
            const { merged, filled } = backfillDepthKeys({
                stateJson: { ...(m.stateJson || {}), ...mergedStateJson },
                entity,
                materialContent: m.currentContent || m.initialContent || '',
            });
            if (filled.length > 0) {
                logger.info('contractEnricher', `深度键回填 ${m.name}: ${filled.join(',')}`);
            }
            enriched.push({ ...m, stateJson: merged });
        } catch (e) {
            logger.warn('contractEnricher', `Failed to enrich ${m.name}: ${e.message}`);
            enriched.push(m);
        }
    }

    return enriched;
}

module.exports = { enrichMaterialsForContract };
