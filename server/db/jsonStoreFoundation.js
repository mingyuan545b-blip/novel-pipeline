const { CACHE_CONFIG } = require('../config/systemConfig');
const { CRAFT_TYPES } = require('../config/materialTypes');

const _foundationCache = new Map();
const FOUNDATION_CACHE_TTL_MS = CACHE_CONFIG.FOUNDATION_CACHE_TTL_MS;
const MAX_FOUNDATION_CACHE_ENTRIES = 500;
let _factionMap = null;
let _factionMapTs = 0;
const FACTION_MAP_TTL_MS = 30000;

let _storeRef = null;

function initStoreRef(store) {
    _storeRef = store;
}

async function _getFactionMap() {
    const now = Date.now();
    if (_factionMap && now - _factionMapTs < FACTION_MAP_TTL_MS) return _factionMap;
    try {
        const allMats = await _storeRef.listItems('materials');
        _factionMap = new Map();
        for (const m of allMats) {
            if (m.type === 'faction' || m.type === 'institution') _factionMap.set(m.id, m);
        }
        _factionMapTs = now;
    } catch (_) { _factionMap = null; }
    return _factionMap;
}

async function isFoundationMaterial(mat, visited = new Set(), depth = 0) {
    if (!mat) return false;
    if (depth > 5) return false;
    const cacheKey = `${mat.type}:${mat.id || mat.name}`;
    const now = Date.now();
    const cached = _foundationCache.get(cacheKey);
    if (cached && now - cached.ts < FOUNDATION_CACHE_TTL_MS) return cached.value;
    let result = false;
    if (mat.isFoundation === true) result = true;
    else if (mat.isFoundation === false) result = false;
    else if (mat.sourceChapter) result = false;
    else if (CRAFT_TYPES.has(mat.type) && !mat.parentPlane) result = true;
    else if (['worldview', 'power-system'].includes(mat.type) && !mat.parentPlane) result = true;
    else if (mat.type === 'faction' && mat.parentPlane === null) result = true;
    else if (mat.type === 'institution' && mat.parentPlane === null) result = true;
    else if (mat.type === 'character' && mat.parentFaction) {
        if (visited.has(mat.parentFaction)) result = false;
        else {
            visited.add(mat.parentFaction);
            const fmap = await _getFactionMap();
            const fac = fmap ? fmap.get(mat.parentFaction) : await _storeRef.getItem('materials', mat.parentFaction);
            if (fac && await isFoundationMaterial(fac, visited, depth + 1)) result = true;
        }
    }
    _foundationCache.set(cacheKey, { value: result, ts: now });
    if (_foundationCache.size > MAX_FOUNDATION_CACHE_ENTRIES) {
        const oldest = [..._foundationCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) _foundationCache.delete(oldest[0]);
    }
    return result;
}

module.exports = { isFoundationMaterial, initStoreRef };
