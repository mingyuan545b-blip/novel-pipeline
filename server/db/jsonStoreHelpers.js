const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { JSON_STORE } = require('../config/systemConfig');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const _indexCache = new Map();
const _indexTimestamps = new Map();
const INDEX_TTL_MS = 30000;
const MAX_CACHE_ENTRIES = 50;

function renameWithRetry(tmpPath, filePath, maxRetries = JSON_STORE.RENAME_MAX_RETRIES, delayMs = JSON_STORE.RENAME_RETRY_DELAY_MS) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            fs.renameSync(tmpPath, filePath);
            return;
        } catch (err) {
            if (err.code !== 'EPERM' && err.code !== 'EACCES') {
                try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
                throw err;
            }
            if (attempt < maxRetries) {
                const backoff = delayMs * Math.pow(2, attempt);
                const start = Date.now();
                while (Date.now() - start < backoff) { /* busy wait */ }
            } else {
                try {
                    fs.copyFileSync(tmpPath, filePath);
                    fs.unlinkSync(tmpPath);
                    return;
                } catch (fallbackErr) {
                    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
                    throw fallbackErr;
                }
            }
        }
    }
}

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
            logger.warn('jsonStore', `\n[STORE-JSON] ⚠️ 另一个Node进程(PID:${existing})正在使用JSON文件存储！`);
            logger.warn('jsonStore', `[STORE-JSON] ⚠️ 多进程并发写入会导致数据损坏。请改用SQLite后端(USE_SQLITE=true)或单进程部署。\n`);
        }
        fs.writeFileSync(_pidFilePath, String(process.pid));
    } catch(_) { logger.warn('jsonStore', _.message || _); }
}

function _unregisterProcess() {
    try { if (fs.existsSync(_pidFilePath)) fs.unlinkSync(_pidFilePath); } catch(_) { logger.warn('jsonStore', _.message || _); }
}

module.exports = {
    DATA_DIR,
    renameWithRetry,
    _getCachedList,
    _setCachedList,
    _invalidateCache,
    _updateCacheEntry,
    _removeCacheEntry,
    _registerProcess,
    _unregisterProcess
};
