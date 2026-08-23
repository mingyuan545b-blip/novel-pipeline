const logger = require('../shared/logger');

const SCOPE_DEFS = {
    'public': { id: 'public', name: '公开', level: 0, description: '所有角色可见' },
    'faction': { id: 'faction', name: '阵营', level: 1, description: '同阵营角色可见' },
    'private': { id: 'private', name: '私密', level: 2, description: '仅本人可见' },
    'secret': { id: 'secret', name: '机密', level: 3, description: '仅特定角色可见' }
};

function buildScopePrompt(scope, entityName) {
    if (!scope) return '';
    const def = SCOPE_DEFS[scope];
    if (!def) return '';
    return `【${entityName || '信息'}的可见范围：${def.name}（${def.description}）】`;
}

function detectScopeViolation(writerScope, readerScope) {
    const writerLevel = SCOPE_DEFS[writerScope]?.level ?? 0;
    const readerLevel = SCOPE_DEFS[readerScope]?.level ?? 0;
    return readerLevel > writerLevel;
}

function resolveEffectiveScope(entityScopes, readerFaction, readerId) {
    if (!entityScopes || entityScopes.length === 0) return 'public';
    const sorted = [...entityScopes].sort((a, b) => (SCOPE_DEFS[b.scope]?.level || 0) - (SCOPE_DEFS[a.scope]?.level || 0));
    for (const entry of sorted) {
        if (entry.scope === 'public') return 'public';
        if (entry.scope === 'faction' && entry.faction === readerFaction) return 'faction';
        if (entry.scope === 'private' && entry.characterId === readerId) return 'private';
        if (entry.scope === 'secret' && entry.allowedIds?.includes(readerId)) return 'secret';
    }
    return sorted[0]?.scope || 'public';
}

function filterByScope(entities, readerId, readerFaction) {
    return entities.filter(entity => {
        const scope = entity.scope || 'public';
        if (scope === 'public') return true;
        if (scope === 'faction') return entity.faction === readerFaction;
        if (scope === 'private') return entity.characterId === readerId;
        if (scope === 'secret') return entity.allowedIds?.includes(readerId);
        return true;
    });
}

module.exports = { SCOPE_DEFS, buildScopePrompt, detectScopeViolation, resolveEffectiveScope, filterByScope };
