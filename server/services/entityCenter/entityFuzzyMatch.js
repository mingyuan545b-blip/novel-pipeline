/**
 * entityFuzzyMatch — 角色名模糊匹配（自 entityCRUD 抽出，控单文件行数）
 * 空名/单字名不参与模糊匹配：''.includes(x) 恒真，会把任意新角色并进"无名实体"。
 */
const store = require('../../store');
const logger = require('../../shared/logger');

const ENTITY_TYPE = 'entities';

async function fuzzyMatchCharacter(projectId, name) {
    const normalizedName = name.toLowerCase().replace(/[\s\-_··]/g, '');
    if (normalizedName.length < 2) return null;
    const allChars = await store.queryItems(ENTITY_TYPE, { projectId, entityType: 'character' });
    const match = allChars.find(e => {
        if (e.lifecycleState === 'archived' || e.archived) return false;
        const eName = (e.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
        if (eName.length < 2) return false;
        return eName === normalizedName || eName.includes(normalizedName) || normalizedName.includes(eName);
    });
    if (match) logger.info('entityCenter', `Fuzzy match: "${name}" -> existing "${match.name}" (${match.id})`);
    return match || null;
}

module.exports = { fuzzyMatchCharacter };
