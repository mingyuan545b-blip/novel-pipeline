/**
 * 摘要数据源回退模块
 * KV数据为空时从entity-registry构建摘要
 */

const store = require('../store');
const { getCharacterStateSchema } = require('../config/characterStateSchemas');

/**
 * 从entity-registry加载角色数据作为KV的回退
 * KV数据为空时，从entity-registry读取position/personality/speakingTone等字段
 */
async function loadEntityFallback(projectId, characterId, kvData) {
    const hasKVData = Object.keys(kvData).some(k => k !== 'name' && k !== 'roleLevel' && kvData[k] !== undefined && kvData[k] !== '');
    if (hasKVData) return kvData;

    try {
        const entities = await store.queryItems('entity-registry', { projectId, entityType: 'character' });
        const entity = entities.find(e => e.id === characterId || e.name === characterId);
        if (!entity) return kvData;

        return {
            ...kvData,
            name: kvData.name || entity.name || characterId,
            roleLevel: kvData.roleLevel || entity.roleLevel || 'npc',
            position: kvData.position || entity.position || '',
            factionName: kvData.factionName || entity.factionName || '',
            personality: kvData.personality || entity.personality || '',
            speakingTone: kvData.speakingTone || entity.speakingTone || '',
            signatureDetail: kvData.signatureDetail || entity.signatureDetail || '',
            craftStyle: kvData.craftStyle || entity.craftStyle || '',
            briefDesc: entity.briefDesc || '',
            behaviorRules: entity.behaviorRules || '',
        };
    } catch (e) {
        return kvData;
    }
}

/**
 * 从entity-registry构建全部角色的摘要（KV为空时的回退）
 */
async function buildSummaryFromEntities(projectId, schema) {
    const entities = await store.queryItems('entity-registry', { projectId, entityType: 'character' });
    const briefLines = [];
    const detailedLines = [];

    const importantKeys = ['position', 'factionName', 'personality', 'speakingTone', 'roleLevel'];

    for (const entity of entities) {
        const name = entity.name || '未知';
        const briefParts = [];
        for (const key of importantKeys) {
            const value = entity[key];
            if (value && value !== '') {
                const field = schema.fields[key];
                const label = field ? field.label : key;
                briefParts.push(`${label}=${value}`);
            }
        }
        briefLines.push(`【${name}】${briefParts.join(', ')}`);

        const detailParts = [];
        const detailKeys = ['position', 'factionName', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'roleLevel', 'behaviorRules', 'briefDesc'];
        for (const key of detailKeys) {
            const value = entity[key];
            if (value && value !== '') {
                const field = schema.fields[key];
                const label = field ? field.label : key;
                detailParts.push(`${label}: ${value}`);
            }
        }
        if (detailParts.length > 0) {
            detailedLines.push(`【${name}】\n${detailParts.join('\n')}`);
        }
    }

    return {
        brief: briefLines.join('\n') || '暂无角色数据',
        detailed: detailedLines.join('\n\n') || '暂无角色数据'
    };
}

module.exports = { loadEntityFallback, buildSummaryFromEntities };
