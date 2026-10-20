'use strict';

const store = require('../../store');
const logger = require('../../shared/logger');
const {
    extractWorldviewFacts, extractPowerSystemFacts,
    extractCharacterFacts, extractRelationshipFacts,
    extractEquipFactionFacts,
} = require('./factExtractors');
const { findOrCreateFact } = require('./factLookup');

const FACT_TYPE = 'knowledge-facts';

/**
 * 从素材同步事实到记忆金字塔
 * 三层提取策略：
 *   M0(永不衰减): 世界观核心规则、力量体系铁律
 *   M1(核心记忆): 角色身份/动机/性格、关键关系
 *   M2(中期记忆): 角色习惯/外貌、装备/势力核心属性
 */
async function syncFactsFromMaterials(projectId, materials, memoryPyramid) {
    const activeMats = (materials || []).filter(m => !m.archived);
    let synced = 0;

    // 预加载已有事实文本，用Set去重
    const existingTexts = new Set();
    try {
        const existingFacts = await store.queryItems(FACT_TYPE, { projectId });
        for (const f of existingFacts) {
            existingTexts.add(f.factText);
        }
    } catch (_) { logger.warn('factSync', _.message || _); }  // DEGRADE: 影响=store.queryItems 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // M0: 世界观核心规则
    for (const mat of activeMats.filter(m => m.type === 'worldview')) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const fact of extractWorldviewFacts(content, mat.name)) {
            if (!existingTexts.has(fact)) {
                await memoryPyramid.addFact(projectId, 'M0', 'worldview', fact, { entityId: mat.id, importance: 90 });
                existingTexts.add(fact); synced++;
            }
        }
    }

    // M0: 力量体系铁律
    for (const mat of activeMats.filter(m => m.type === 'power-system')) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const fact of extractPowerSystemFacts(content, mat.name)) {
            if (!existingTexts.has(fact)) {
                await memoryPyramid.addFact(projectId, 'M0', 'power-system', fact, { entityId: mat.id, importance: 85 });
                existingTexts.add(fact); synced++;
            }
        }
    }

    // M1: 角色核心设定
    for (const mat of activeMats.filter(m => m.type === 'character')) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const fact of extractCharacterFacts(content, mat.name)) {
            if (!existingTexts.has(fact)) {
                await memoryPyramid.addFact(projectId, 'M1', 'character-core', fact, { entityId: mat.id, importance: 75 });
                existingTexts.add(fact); synced++;
            }
        }
    }

    // M2: 关键关系事实
    for (const mat of activeMats.filter(m => m.type === 'relationship')) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const fact of extractRelationshipFacts(content, mat.name)) {
            if (!existingTexts.has(fact)) {
                await memoryPyramid.addFact(projectId, 'M2', 'relationship', fact, { entityId: mat.id, importance: 60 });
                existingTexts.add(fact); synced++;
            }
        }
    }

    // M2: 装备/势力核心属性
    for (const mat of activeMats.filter(m => m.type === 'equipment' || m.type === 'faction')) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const fact of extractEquipFactionFacts(content, mat.name, mat.type)) {
            if (!existingTexts.has(fact)) {
                await memoryPyramid.addFact(projectId, 'M2', mat.type, fact, { entityId: mat.id, importance: 55 });
                existingTexts.add(fact); synced++;
            }
        }
    }

    return synced;
}

module.exports = { syncFactsFromMaterials, findOrCreateFact };
