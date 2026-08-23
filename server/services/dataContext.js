/**
 * DataContext — 所有Agent的唯一数据入口
 * 原则：Agent不直接读store，全部通过DataContext获取数据
 * DataContext内部管理缓存，避免重复查询
 *
 * 拆分说明：
 * - dataContextProject.js: 项目/章节/素材/题材查询mixin
 * - dataContextDelegates.js: 实体/时间轴/战力/伏笔/弧线/审计委托mixin
 */
const ProjectMixin = require('./dataContextProject');
const DelegateMixin = require('./dataContextDelegates');

class DataContext {
    constructor(projectId) {
        this.projectId = projectId;
        this._cache = {};
        this._cacheValid = {};
    }

    // ── 缓存管理 ──

    async _cached(key, fetcher) {
        if (this._cacheValid[key]) return this._cache[key];
        this._cache[key] = await fetcher();
        this._cacheValid[key] = true;
        return this._cache[key];
    }

    invalidate(key = null) {
        if (key) {
            delete this._cache[key];
            delete this._cacheValid[key];
        } else {
            this._cache = {};
            this._cacheValid = {};
        }
    }

    invalidateMaterials() {
        for (const key of Object.keys(this._cacheValid)) {
            if (key.startsWith('materials')) {
                delete this._cache[key];
                delete this._cacheValid[key];
            }
        }
    }
}

// 混入两个mixin
Object.assign(DataContext.prototype, ProjectMixin, DelegateMixin);

// 项目级DataContext缓存
const _contextCache = new Map();

async function getDataContext(projectId) {
    if (!_contextCache.has(projectId)) {
        const ctx = new DataContext(projectId);
        _contextCache.set(projectId, ctx);
    }
    return _contextCache.get(projectId);
}

function resetDataContext(projectId) {
    if (projectId) {
        _contextCache.delete(projectId);
    } else {
        _contextCache.clear();
    }
}

module.exports = { DataContext, getDataContext, resetDataContext };
