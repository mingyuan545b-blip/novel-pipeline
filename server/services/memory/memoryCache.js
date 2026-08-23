const {
    MEMORY_LAYERS,
    CACHE_TTL,
    CACHE_MAX
} = require('./memoryConstants');

class MemoryCache {
    constructor() {
        this._cache = new Map();
    }

    _cacheKey(projectId, layer) {
        return `${projectId}:${layer}`;
    }

    _invalidateCache(projectId, layer) {
        if (layer) {
            this._cache.delete(this._cacheKey(projectId, layer));
        } else {
            for (const key of this._cache.keys()) {
                if (key.startsWith(projectId + ':')) {
                    this._cache.delete(key);
                }
            }
        }
    }

    _cleanExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of this._cache.entries()) {
            if (entry._cachedAt && (now - entry._cachedAt) > CACHE_TTL) {
                this._cache.delete(key);
            }
        }
        if (this._cache.size > CACHE_MAX) {
            const entries = [...this._cache.entries()].sort((a, b) =>
                (a[1]._cachedAt || 0) - (b[1]._cachedAt || 0)
            );
            const toRemove = entries.slice(0, this._cache.size - CACHE_MAX);
            for (const [key] of toRemove) this._cache.delete(key);
        }
    }

    async get(projectId, layer, storeFetchFn) {
        this._cleanExpiredCache();
        const key = this._cacheKey(projectId, layer);
        if (this._cache.has(key)) {
            const entry = this._cache.get(key);
            if (entry._cachedAt && (Date.now() - entry._cachedAt) > CACHE_TTL) {
                this._cache.delete(key);
            } else {
                return entry;
            }
        }

        const data = await storeFetchFn();
        if (data) {
            const cached = { ...data, _cachedAt: Date.now() };
            this._cache.set(key, cached);
            return cached;
        }
        return data;
    }

    invalidate(projectId, layer) {
        this._invalidateCache(projectId, layer);
    }
}

module.exports = { MemoryCache };
