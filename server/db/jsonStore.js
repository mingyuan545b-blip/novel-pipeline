const fs = require('fs');
const path = require('path');
const { STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING } = require('../config/systemConfig');
const { CRAFT_TYPES } = require('../config/materialTypes');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const writeLocks = new Map();
const _indexCache = new Map();
const _indexTimestamps = new Map();
const INDEX_TTL_MS = 30000;
const MAX_CACHE_ENTRIES = 50;

const _pidFilePath = path.join(DATA_DIR, '.jsonstore.pid');
function _registerProcess() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const existing = fs.existsSync(_pidFilePath) ? fs.readFileSync(_pidFilePath, 'utf-8').trim() : '';
        if (existing && existing !== String(process.pid)) {
            try { process.kill(Number(existing), 0); } catch (_) {
                fs.writeFileSync(_pidFilePath, String(process.pid));
                return;
            }
            console.warn(`\n[STORE-JSON] ⚠️ 另一个Node进程(PID:${existing})正在使用JSON文件存储！`);
            console.warn(`[STORE-JSON] ⚠️ 多进程并发写入会导致数据损坏。请改用SQLite后端(USE_SQLITE=true)或单进程部署。\n`);
        }
        fs.writeFileSync(_pidFilePath, String(process.pid));
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
}
function _unregisterProcess() {
    try { if (fs.existsSync(_pidFilePath)) fs.unlinkSync(_pidFilePath); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
}
_registerProcess();
process.on('exit', _unregisterProcess);

function _getCachedList(type) {
    const now = Date.now();
    const lastTs = _indexTimestamps.get(type) || 0;
    if (now - lastTs < INDEX_TTL_MS && _indexCache.has(type)) {
        return _indexCache.get(type);
    }
    return null;
}

function _setCachedList(type, items) {
    if (_indexCache.size >= MAX_CACHE_ENTRIES) {
        const oldest = [..._indexTimestamps.entries()].sort((a, b) => a[1] - b[1])[0];
        if (oldest) {
            _indexCache.delete(oldest[0]);
            _indexTimestamps.delete(oldest[0]);
        }
    }
    _indexCache.set(type, items);
    _indexTimestamps.set(type, Date.now());
}

function _invalidateCache(type) {
    _indexCache.delete(type);
    _indexTimestamps.delete(type);
}

function _updateCacheEntry(type, item) {
    if (!_indexCache.has(type)) return;
    const items = _indexCache.get(type);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
        items[idx] = item;
    } else {
        items.push(item);
    }
}

function _removeCacheEntry(type, id) {
    if (!_indexCache.has(type)) return;
    const items = _indexCache.get(type);
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) {
        items.splice(idx, 1);
    }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateId(id) {
    if (!id || typeof id !== 'string') return false;
    if (UUID_REGEX.test(id)) return true;
    if (SAFE_ID_REGEX.test(id) && !id.includes('..') && id.length <= 128) return true;
    return false;
}

async function acquireLock(type, id) {
    const key = `${type}:${id}`;
    const maxWaitMs = 15000;
    const start = Date.now();
    while (true) {
        const holder = writeLocks.get(key);
        if (!holder) break;
        if (Date.now() - holder.time > 10000) {
            writeLocks.delete(key);
            break;
        }
        if (Date.now() - start > maxWaitMs) {
            writeLocks.delete(key);
            console.warn(`[STORE-JSON] Lock wait timeout for ${key}, force breaking after ${maxWaitMs}ms`);
            break;
        }
        await new Promise(r => setTimeout(r, 50));
    }
    writeLocks.set(key, { time: Date.now() });
}

function releaseLock(type, id) {
    writeLocks.delete(`${type}:${id}`);
}

function readDir(type) {
    const dir = path.join(DATA_DIR, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function listItems(type) {
    const cached = _getCachedList(type);
    if (cached) return cached;
    const dir = readDir(type);
    const items = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            try {
                const content = fs.readFileSync(path.join(dir, f), 'utf-8').replace(/^\uFEFF/, '');
                if (!content.trim()) return null;
                return JSON.parse(content);
            } catch (e) {
                console.warn(`[STORE-JSON] Corrupt file skipped: ${type}/${f}`);
                return null;
            }
        })
        .filter(Boolean);
    _setCachedList(type, items);
    return items;
}

function getItem(type, id) {
    if (!validateId(id)) {
        console.warn(`[STORE-JSON] Invalid id rejected: ${type}/${id}`);
        return null;
    }
    const filePath = path.join(readDir(type), `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
        if (!content.trim()) return null;
        return JSON.parse(content);
    } catch (e) {
        console.warn(`[STORE-JSON] Corrupt file on read: ${type}/${id}`, e.message);
        return null;
    }
}

async function setItem(type, id, data) {
    if (!validateId(id)) {
        throw new Error(`Invalid id: ${type}/${id}`);
    }
    const dir = readDir(type);
    const filePath = path.join(dir, `${id}.json`);
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;

    let serialized = JSON.stringify(data, null, 2);
    if (serialized.length > maxSize) {
        console.warn(`[STORE-JSON] Item ${type}/${id} size ${Math.round(serialized.length/1024)}KB exceeds limit ${Math.round(maxSize/1024)}KB, trimming...`);
        if (type === 'chapters' && data.history) {
            data.history = data.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
            const truncFields = {
                writerOutput: 5000,
                firstReviewOutput: STORE_TRIMMING.outputTruncateLength,
                secondReviewOutput: STORE_TRIMMING.outputTruncateLength,
                finalEditorOutput: STORE_TRIMMING.outputTruncateLength,
                materialManagerOutput: STORE_TRIMMING.outputTruncateLength,
                readerOutput: STORE_TRIMMING.readerOutputTruncate,
                adjusterOutput: STORE_TRIMMING.adjusterOutputTruncate,
                reviserOutput: STORE_TRIMMING.outputTruncateLength,
                reviserOutputRaw: STORE_TRIMMING.outputTruncateLength,
                polisherOutput: STORE_TRIMMING.outputTruncateLength
            };
            for (const [field, maxLen] of Object.entries(truncFields)) {
                if (data[field] && data[field].length > maxLen) {
                    data[field] = data[field].substring(0, maxLen) + '\n...[truncated]';
                }
            }
        }
        if (type === 'materials' && data.changeLog && data.changeLog.length > STORE_TRIMMING.materialChangeLogKeep) {
            data.changeLog = data.changeLog.slice(-STORE_TRIMMING.materialChangeLogKeep);
        }
        if (type === 'projects') {
            if (data.chapters && data.chapters.length > STORE_TRIMMING.projectChaptersKeep) data.chapters = data.chapters.slice(-STORE_TRIMMING.projectChaptersKeep);
            if (data.chapterIntents?.chapters && !Array.isArray(data.chapterIntents.chapters)) {
                const keys = Object.keys(data.chapterIntents.chapters);
                if (keys.length > STORE_TRIMMING.projectChapterIntentsKeep) {
                    const keepKeys = keys.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
                    const trimmed = {};
                    for (const k of keepKeys) trimmed[k] = data.chapterIntents.chapters[k];
                    data.chapterIntents.chapters = trimmed;
                }
            }
            if (data.description && data.description.length > STORE_TRIMMING.projectDescriptionMaxLength) data.description = data.description.substring(0, STORE_TRIMMING.projectDescriptionMaxLength);
        }
        serialized = JSON.stringify(data, null, 2);
    }

    if (serialized.length > maxSize * 1.5) {
        console.error(`[STORE-JSON] Item ${type}/${id} still ${Math.round(serialized.length/1024)}KB after trimming. Forcing compact serialization.`);
        serialized = JSON.stringify(data);
    }

    await acquireLock(type, id);
    try {
        const tmpPath = path.join(dir, `${id}.tmp.${Date.now()}`);
        fs.writeFileSync(tmpPath, serialized, 'utf-8');
        const verifyContent = fs.readFileSync(tmpPath, 'utf-8');
        try {
            JSON.parse(verifyContent);
        } catch (e) {
            console.error(`[STORE-JSON] Write verification failed for ${type}/${id}, aborting write!`);
            fs.unlinkSync(tmpPath);
            return data;
        }
        fs.renameSync(tmpPath, filePath);
    } finally {
        releaseLock(type, id);
    }
    _updateCacheEntry(type, data);
    return data;
}

async function updateItem(type, id, updateFn) {
    if (!validateId(id)) {
        throw new Error(`Invalid id: ${type}/${id}`);
    }
    await acquireLock(type, id);
    try {
        const current = getItem(type, id);
        if (!current) {
            releaseLock(type, id);
            return null;
        }
        const updated = updateFn(current);
        if (!updated) {
            releaseLock(type, id);
            return current;
        }
        const dir = readDir(type);
        const filePath = path.join(dir, `${id}.json`);
        const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
        let serialized = JSON.stringify(updated, null, 2);
        if (serialized.length > maxSize) {
            if (type === 'chapters' && updated.history) {
                updated.history = updated.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
            }
            serialized = JSON.stringify(updated, null, 2);
        }
        if (serialized.length > maxSize * 1.5) {
            serialized = JSON.stringify(updated);
        }
        const tmpPath = path.join(dir, `${id}.tmp.${Date.now()}`);
        fs.writeFileSync(tmpPath, serialized, 'utf-8');
        const verifyContent = fs.readFileSync(tmpPath, 'utf-8');
        try {
            JSON.parse(verifyContent);
        } catch (e) {
            console.error(`[STORE-JSON] updateItem write verification failed for ${type}/${id}, aborting!`);
            try { fs.unlinkSync(tmpPath); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            return current;
        }
        fs.renameSync(tmpPath, filePath);
        _updateCacheEntry(type, updated);
        return updated;
    } finally {
        releaseLock(type, id);
    }
}

function deleteItem(type, id) {
    if (!validateId(id)) {
        console.warn(`[STORE-JSON] Invalid id rejected for deletion: ${type}/${id}`);
        return false;
    }
    if (type === 'materials') {
        const item = getItem(type, id);
        if (item && isFoundationMaterial(item)) {
            console.warn(`[STORE-JSON] Blocked deletion of foundation material: ${id} (${item.name})`);
            return false;
        }
    }
    const filePath = path.join(readDir(type), `${id}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        _removeCacheEntry(type, id);
        return true;
    }
    return false;
}

const _foundationCache = new Map();
const FOUNDATION_CACHE_TTL_MS = 10000;
const MAX_FOUNDATION_CACHE_ENTRIES = 500;

let _factionMap = null;
let _factionMapTs = 0;
const FACTION_MAP_TTL_MS = 30000;

function _getFactionMap() {
    const now = Date.now();
    if (_factionMap && now - _factionMapTs < FACTION_MAP_TTL_MS) return _factionMap;
    try {
        const allMats = listItems('materials');
        _factionMap = new Map();
        for (const m of allMats) {
            if (m.type === 'faction' || m.type === 'institution') {
                _factionMap.set(m.id, m);
            }
        }
        _factionMapTs = now;
    } catch (_) {
        _factionMap = null;
    }
    return _factionMap;
}

function isFoundationMaterial(mat, visited = new Set(), depth = 0) {
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
            const fmap = _getFactionMap();
            const fac = fmap ? fmap.get(mat.parentFaction) : getItem('materials', mat.parentFaction);
            if (fac && isFoundationMaterial(fac, visited, depth + 1)) result = true;
        }
    }
    _foundationCache.set(cacheKey, { value: result, ts: now });
    if (_foundationCache.size > MAX_FOUNDATION_CACHE_ENTRIES) {
        const oldest = [..._foundationCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) _foundationCache.delete(oldest[0]);
    }
    return result;
}

function queryItems(type, filter) {
    const items = listItems(type);
    if (!filter) return items;
    if (typeof filter === 'function') return items.filter(filter);
    return items.filter(item => {
        return Object.keys(filter).every(key => {
            return item[key] === filter[key];
        });
    });
}

module.exports = { listItems, getItem, setItem, updateItem, deleteItem, queryItems, isFoundationMaterial, DATA_DIR };
