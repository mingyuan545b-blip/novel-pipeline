/**
 * 大纲关系创建模块
 * 从大纲素材中提取角色关系并写入character-relations store
 */

const logger = require('../../shared/logger');
const store = require('../../store');
const { v4: uuidv4 } = require('uuid');

function buildCharNameMap(materials, createdItems) {
    const map = {};
    for (const mat of materials) {
        if (mat.type !== 'character') continue;
        const created = createdItems.find(ci => ci.materialId === mat.id || ci.name === mat.name);
        if (created) map[mat.name] = created.entityId || created.id;
    }
    return map;
}

async function createCharacterRelations(projectId, materials, createdItems) {
    const charNameToId = buildCharNameMap(materials, createdItems);
    const now = new Date().toISOString();

    // 1. 从type=relationship的素材中提取关系（增强匹配）
    for (const mat of materials) {
        if (mat.type !== 'relationship' || !mat.content) continue;
        try {
            const nameMatch = mat.name?.match(/(.+?)[与和—\-–](.+?)[：:]/) || mat.name?.match(/(.+?)[与和](.+)/);
            if (!nameMatch) continue;
            const fromId = charNameToId[nameMatch[1].trim()];
            const toId = charNameToId[nameMatch[2].trim()];
            if (!fromId || !toId) continue;
            const relId = `rel-${uuidv4()}`;
            await store.setItem('character-relations', relId, {
                id: relId, projectId, fromCharacterId: fromId, toCharacterId: toId,
                relType: 'other', relLabel: mat.name || '', strength: 50, trustLevel: 50,
                startChapter: 0, endChapter: null, isSecret: false,
                notes: (mat.content || '').substring(0, 500),
                createdAt: now, updatedAt: now
            });
        } catch (err) { logger.warn('outlineRelCreate', '[OUTLINE] Relation create failed:', err.message); }  // DEGRADE: 影响=大纲关系创建 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    // 2. 从角色素材content中提取关系描述
    const REL_PATTERNS = [
        /(?:与|和)(.{2,8}?)(?:是|为|成为|结为|建立)(.{2,10}?)(?:关系|之交|之情|之谊)/g,
        /(?:师|徒|兄|弟|姐|妹|父|母|子|女|夫|妻)[：:]\s*(.{2,8})/g,
        /(?:关系|羁绊)[：:]\s*(.{2,30})/g,
    ];
    for (const mat of materials) {
        if (mat.type !== 'character' || !mat.content || !mat.name) continue;
        const fromId = charNameToId[mat.name];
        if (!fromId) continue;

        for (const pattern of REL_PATTERNS) {
            let match;
            pattern.lastIndex = 0;
            while ((match = pattern.exec(mat.content)) !== null) {
                const targetName = match[1]?.trim();
                if (!targetName) continue;
                const toId = charNameToId[targetName];
                if (!toId || toId === fromId) continue;

                const existingRels = await store.queryItems('character-relations', { projectId });
                const alreadyExists = existingRels.some(r =>
                    (r.fromCharacterId === fromId && r.toCharacterId === toId) ||
                    (r.fromCharacterId === toId && r.toCharacterId === fromId)
                );
                if (alreadyExists) continue;

                const relId = `rel-${uuidv4()}`;
                await store.setItem('character-relations', relId, {
                    id: relId, projectId, fromCharacterId: fromId, toCharacterId: toId,
                    relType: 'other', relLabel: match[0]?.substring(0, 30) || '',
                    strength: 50, trustLevel: 50,
                    startChapter: 0, endChapter: null, isSecret: false,
                    notes: match[0] || '',
                    createdAt: now, updatedAt: now
                });
            }
        }
    }
}

module.exports = { createCharacterRelations, buildCharNameMap };
