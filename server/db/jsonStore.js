const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING, CACHE_CONFIG } = require('../config/systemConfig');
const { CRAFT_TYPES } = require('../config/materialTypes');
const { DATA_DIR, renameWithRetry, _getCachedList, _setCachedList, _updateCacheEntry, _removeCacheEntry, _registerProcess, _unregisterProcess } = require('./jsonStoreHelpers');
const { isFoundationMaterial, initStoreRef } = require('./jsonStoreFoundation');

_registerProcess();
process.on('exit', _unregisterProcess);

const writeLocks = new Map();
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
        if (Date.now() - holder.time > 10000) { writeLocks.delete(key); break; }
        if (Date.now() - start > maxWaitMs) {
            writeLocks.delete(key);
            logger.warn('jsonStore', `[STORE-JSON] Lock wait timeout for ${key}`);
            break;
        }
        await new Promise(r => setTimeout(r, 50));
    }
    writeLocks.set(key, { time: Date.now() });
}

function releaseLock(type, id) { writeLocks.delete(`${type}:${id}`); }

function readDir(type) {
    const dir = path.join(DATA_DIR, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function listItems(type) {
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
                logger.warn('jsonStore', `[STORE-JSON] Corrupt file skipped: ${type}/${f}`);
                return null;
            }
        })
        .filter(Boolean);
    _setCachedList(type, items);
    return items;
}

async function getItem(type, id) {
    if (!validateId(id)) { logger.warn('jsonStore', `[STORE-JSON] Invalid id rejected: ${type}/${id}`); return null; }
    const filePath = path.join(readDir(type), `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
        if (!content.trim()) return null;
        return JSON.parse(content);
    } catch (e) { logger.warn('jsonStore', `[STORE-JSON] Corrupt file on read: ${type}/${id}`, e.message); return null; }  // DEGRADE: 影响=fs.readFileSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

async function setItem(type, id, data) {
    if (!validateId(id)) throw new Error(`Invalid id: ${type}/${id}`);
    const dir = readDir(type);
    const filePath = path.join(dir, `${id}.json`);
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
    let serialized = JSON.stringify(data, null, 2);
    if (serialized.length > maxSize) {
        logger.warn('jsonStore', `[STORE-JSON] Item ${type}/${id} exceeds limit, trimming...`);
        trimDataByType(type, data);
        serialized = JSON.stringify(data, null, 2);
    }
    if (serialized.length > maxSize * 1.5) {
        logger.error('jsonStore', `[STORE-JSON] Item ${type}/${id} still oversized. Forcing compact.`);
        serialized = JSON.stringify(data);
    }
    await acquireLock(type, id);
    try {
        const tmpPath = path.join(dir, `${id}.tmp.${Date.now()}`);
        fs.writeFileSync(tmpPath, serialized, 'utf-8');
        try { JSON.parse(fs.readFileSync(tmpPath, 'utf-8')); } catch (e) {
            logger.error('jsonStore', `[STORE-JSON] Write verification failed for ${type}/${id}`);
            fs.unlinkSync(tmpPath);
            return data;
        }
        renameWithRetry(tmpPath, filePath);
    } finally { releaseLock(type, id); }
    _updateCacheEntry(type, data);
    return data;
}

function trimDataByType(type, data) {
    if (type === 'chapters' && data.history) {
        data.history = data.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
        const truncFields = { writerOutput: 5000, firstReviewOutput: STORE_TRIMMING.outputTruncateLength, secondReviewOutput: STORE_TRIMMING.outputTruncateLength, finalEditorOutput: STORE_TRIMMING.outputTruncateLength, materialManagerOutput: STORE_TRIMMING.outputTruncateLength, readerOutput: STORE_TRIMMING.readerOutputTruncate, reviserOutput: STORE_TRIMMING.outputTruncateLength, reviserOutputRaw: STORE_TRIMMING.outputTruncateLength, polisherOutput: STORE_TRIMMING.outputTruncateLength };
        for (const [field, maxLen] of Object.entries(truncFields)) {
            if (data[field] && data[field].length > maxLen) data[field] = data[field].substring(0, maxLen) + '\n...[truncated]';
        }
    }
    if (type === 'materials' && data.changeLog && data.changeLog.length > STORE_TRIMMING.materialChangeLogKeep) data.changeLog = data.changeLog.slice(-STORE_TRIMMING.materialChangeLogKeep);
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
}

async function updateItem(type, id, updateFn) {
    if (!validateId(id)) throw new Error(`Invalid id: ${type}/${id}`);
    await acquireLock(type, id);
    try {
        const current = await getItem(type, id);
        if (!current) return null;
        const updated = updateFn(current);
        if (!updated) return current;
        const dir = readDir(type);
        const filePath = path.join(dir, `${id}.json`);
        const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
        let serialized = JSON.stringify(updated, null, 2);
        if (serialized.length > maxSize) {
            if (type === 'chapters' && updated.history) updated.history = updated.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
            serialized = JSON.stringify(updated, null, 2);
        }
        if (serialized.length > maxSize * 1.5) serialized = JSON.stringify(updated);
        const tmpPath = path.join(dir, `${id}.tmp.${Date.now()}`);
        fs.writeFileSync(tmpPath, serialized, 'utf-8');
        try { JSON.parse(fs.readFileSync(tmpPath, 'utf-8')); } catch (e) {
            logger.error('jsonStore', `[STORE-JSON] updateItem verification failed for ${type}/${id}`);
            try { fs.unlinkSync(tmpPath); } catch(_) { /* ignore unlink failure */ }
            return current;
        }
        renameWithRetry(tmpPath, filePath);
        _updateCacheEntry(type, updated);
        return updated;
    } finally { releaseLock(type, id); }
}

async function deleteItem(type, id) {
    if (!validateId(id)) { logger.warn('jsonStore', `[STORE-JSON] Invalid id for deletion: ${type}/${id}`); return false; }
    if (type === 'materials') {
        const item = await getItem(type, id);
        if (item && await isFoundationMaterial(item)) {
            logger.warn('jsonStore', `[STORE-JSON] Blocked deletion of foundation material: ${id} (${item.name})`);
            return false;
        }
    }
    const filePath = path.join(readDir(type), `${id}.json`);
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); _removeCacheEntry(type, id); return true; }
    return false;
}

async function queryItems(type, filter) {
    const items = await listItems(type);
    if (!filter) return items;
    if (typeof filter === 'function') return items.filter(filter);
    return items.filter(item => Object.keys(filter).every(key => item[key] === filter[key]));
}

initStoreRef({ listItems, getItem });

module.exports = { listItems, getItem, setItem, updateItem, deleteItem, queryItems, isFoundationMaterial, DATA_DIR };
