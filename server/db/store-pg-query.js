const { getDatabase, getTableForType, safeParse, queryAll,
    queryMaterialsByProject: queryMaterialsByProjectDB,
    queryChaptersByProject: queryChaptersByProjectDB,
    queryCharacterStates: queryCharacterStatesDB,
    queryStateKvIndex: queryStateKvIndexDB,
    queryCharacterStateCache: queryCharacterStateCacheDB,
    queryEntityRegistry: queryEntityRegistryDB,
    queryItemDefinitions: queryItemDefinitionsDB,
    queryCharacterBinds: queryCharacterBindsDB,
    queryCharacterRelations: queryCharacterRelationsDB,
    queryPetEntities: queryPetEntitiesDB,
    queryServantEntities: queryServantEntitiesDB,
    queryChronicle: queryChronicleDB,
    queryKnowledgeAccess: queryKnowledgeAccessDB
} = require('./database-pg');
const { applyFilter, isFoundationMaterialCheck } = require('./storeCommon');
const { listItems } = require('./store-pg-core');
const logger = require('../shared/logger');

const _foundationCache = new Map();
const FOUNDATION_CACHE_TTL_MS = 10000;
const MAX_FOUNDATION_CACHE_ENTRIES = 500;

let _factionMap = null;
let _factionMapTs = 0;
const FACTION_MAP_TTL_MS = 30000;

function invalidateFactionMap() {
    _factionMap = null;
    _factionMapTs = 0;
    _foundationCache.clear();
}

async function _getFactionMap() {
    const now = Date.now();
    if (_factionMap && now - _factionMapTs < FACTION_MAP_TTL_MS) return _factionMap;
    try {
        const allMats = await listItems('materials');
        _factionMap = new Map();
        for (const m of allMats) {
            if (m.type === 'faction' || m.type === 'institution') _factionMap.set(m.id, m);
        }
        _factionMapTs = now;
    } catch (_) {
        logger.warn('store-pg', 'Faction map build failed, falling back to null', { error: _.message || _ });
        _factionMap = null;
    }
    return _factionMap;
}

async function isFoundationMaterial(mat, visited = new Set(), depth = 0) {
    if (!mat) return false;
    if (depth > 5) return false;
    const cacheKey = `${mat.type}:${mat.id || mat.name}`;
    const now = Date.now();
    const cached = _foundationCache.get(cacheKey);
    if (cached && now - cached.ts < FOUNDATION_CACHE_TTL_MS) return cached.value;
    const fmap = await _getFactionMap();
    const getFactionFn = (factionId) => fmap ? fmap.get(factionId) : null;
    const result = isFoundationMaterialCheck(mat, getFactionFn, visited, depth);
    _foundationCache.set(cacheKey, { value: result, ts: now });
    if (_foundationCache.size > MAX_FOUNDATION_CACHE_ENTRIES) {
        const entries = [..._foundationCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
        const removeCount = Math.ceil(_foundationCache.size * 0.2);
        for (let i = 0; i < removeCount; i++) _foundationCache.delete(entries[i][0]);
    }
    return result;
}

async function queryMaterialsByProject(projectId, options = {}) {
    try { return await queryMaterialsByProjectDB(projectId, options); }
    catch (_) {
        logger.warn('store-pg', 'queryMaterialsByProject DB query failed, falling back', { projectId, error: _.message || _ });
        const items = await listItems('materials');
        return items.filter(m => {
            if (m.projectId !== projectId) return false;
            if (options.type && m.type !== options.type) return false;
            if (options.archived === false && m.archived) return false;
            if (options.parentPlane && m.parentPlane !== options.parentPlane) return false;
            if (options.roleLevel && m.roleLevel !== options.roleLevel) return false;
            if (options.currentStatus && m.currentStatus !== options.currentStatus) return false;
            if (options.lastAppearChapter && (m.lastAppearChapter || 0) < options.lastAppearChapter) return false;
            return true;
        });
    }
}

async function queryChaptersByProject(projectId, options = {}) {
    try { return await queryChaptersByProjectDB(projectId, options); }
    catch (_) {
        logger.warn('store-pg', 'queryChaptersByProject DB query failed, falling back', { projectId, error: _.message || _ });
        const items = await listItems('chapters');
        return items.filter(c => {
            if (c.projectId !== projectId) return false;
            if (options.status && c.status !== options.status) return false;
            return true;
        }).sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    }
}

async function queryItems(type, filter) {
    if (!filter) return await listItems(type);
    if (type === 'materials' && filter.projectId) {
        const opts = { ...filter }; delete opts.projectId;
        return await queryMaterialsByProject(filter.projectId, opts);
    }
    if (type === 'chapters' && filter.projectId) {
        const opts = { ...filter }; delete opts.projectId;
        return await queryChaptersByProject(filter.projectId, opts);
    }
    if (type === 'api-keys' && filter.provider) {
        const pool = getDatabase();
        const rows = await queryAll(pool, 'SELECT data FROM api_keys WHERE provider = ?', [filter.provider]);
        const items = rows.map(r => safeParse(r.data)).filter(Boolean);
        const remaining = { ...filter }; delete remaining.provider;
        return Object.keys(remaining).length > 0 ? applyFilter(items, remaining) : items;
    }
    if (type === 'api-keys' && filter.type === 'key') {
        const pool = getDatabase();
        const rows = await queryAll(pool, 'SELECT data FROM api_keys');
        const items = rows.map(r => safeParse(r.data)).filter(Boolean).filter(k => k.type === 'key');
        const remaining = { ...filter }; delete remaining.type;
        return Object.keys(remaining).length > 0 ? applyFilter(items, remaining) : items;
    }
    if (type === 'api-keys' && filter.type === 'agent-binding') {
        const pool = getDatabase();
        const rows = await queryAll(pool, 'SELECT data FROM agent_bindings');
        const items = rows.map(r => safeParse(r.data)).filter(Boolean);
        const remaining = { ...filter }; delete remaining.type;
        return Object.keys(remaining).length > 0 ? applyFilter(items, remaining) : items;
    }

    const dbQueryMap = {
        'character-states': { fn: queryCharacterStatesDB, key: 'projectId' },
        'state-kv-index': { fn: queryStateKvIndexDB, key: 'projectId' },
        'entity-registry': { fn: queryEntityRegistryDB, key: 'projectId' },
        'item-definitions': { fn: queryItemDefinitionsDB, key: 'projectId' },
        'character-binds': { fn: queryCharacterBindsDB, key: 'projectId' },
        'character-relations': { fn: queryCharacterRelationsDB, key: 'projectId' },
        'pet-entities': { fn: queryPetEntitiesDB, key: 'projectId' },
        'servant-entities': { fn: queryServantEntitiesDB, key: 'projectId' },
        'character-chronicle': { fn: queryChronicleDB, key: 'projectId' },
        'knowledge-access': { fn: queryKnowledgeAccessDB, key: 'projectId' }
    };
    const dbQuery = dbQueryMap[type];
    if (dbQuery && filter[dbQuery.key]) {
        const opts = { ...filter }; delete opts[dbQuery.key];
        try { return await dbQuery.fn(filter[dbQuery.key], opts); }
        catch (_) { logger.warn('store-pg', `${type} DB query failed, falling back`, { error: _.message }); }  // DEGRADE: 影响=dbQuery.fn 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    if (type === 'character-state-cache' && filter.projectId && filter.chapterNumber) {
        const opts = { ...filter }; delete opts.projectId; delete opts.chapterNumber;
        try { return await queryCharacterStateCacheDB(filter.projectId, filter.chapterNumber, opts); }
        catch (_) { logger.warn('store-pg', 'character-state-cache DB query failed, falling back', { error: _.message }); }  // DEGRADE: 影响=queryCharacterStateCacheDB 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    return applyFilter(await listItems(type), filter);
}

module.exports = { queryItems, isFoundationMaterial, queryMaterialsByProject, queryChaptersByProject, invalidateFactionMap };
