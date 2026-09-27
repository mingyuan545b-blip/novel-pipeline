const logger = require('../shared/logger');
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { getDataContext } = require('./dataContext');
const io = require('./materialIndexIO');
const { isMaterialActiveAt } = require('./materialLifecycle');

const PERMANENT_TYPES = new Set(['worldview', 'power-system', 'sub-plane', 'craft', 'writing-technique']);
const EPHEMERAL_TYPES = new Set(['mechanism', 'location', 'catchphrase', 'famous-scene', 'index', 'other', 'narrative-bridge']);

class MaterialIndex {
    constructor() { this._cache = {}; this._cacheTTL = 30000; }

    _readJson(filePath) { return io.readJson(filePath, this._cache, this._cacheTTL); }
    _writeJson(filePath, data) { return io.writeJson(filePath, data, this._cache); }

    _getLifecycle(m) {
        if (PERMANENT_TYPES.has(m.type)) return 'permanent';
        if (EPHEMERAL_TYPES.has(m.type)) return 'ephemeral';
        if (!m.parentPlane || m.parentPlane === '主世界') return 'permanent';
        if (m.type === 'character' || m.type === 'faction') return 'semiPermanent';
        if (m.type === 'equipment' && m.name && m.name.includes('主角')) return 'semiPermanent';
        return 'ephemeral';
    }

    async rebuildIndex(projectId) {
        const materials = await store.queryItems('materials', { projectId });
        // 建索引无章节上下文 → chapter=0（只排除归档/报废，不裁剪区间）
        const activeMats = materials.filter(m => isMaterialActiveAt(m, 0));
        const planeIndex = {};
        const typeIndex = {};
        const lifecycleIndex = {};

        for (const m of activeMats) {
            const plane = m.parentPlane || '主世界';
            if (!planeIndex[plane]) planeIndex[plane] = {};
            if (!planeIndex[plane][m.type]) planeIndex[plane][m.type] = [];
            planeIndex[plane][m.type].push(m.id);
            if (!typeIndex[m.type]) typeIndex[m.type] = [];
            typeIndex[m.type].push(m.id);
            const lc = this._getLifecycle(m);
            if (!lifecycleIndex[lc]) lifecycleIndex[lc] = [];
            lifecycleIndex[lc].push(m.id);
        }

        this._writeJson(io.PLANE_INDEX_FILE(projectId), planeIndex);
        this._writeJson(io.TYPE_INDEX_FILE(projectId), typeIndex);
        this._writeJson(io.LIFECYCLE_INDEX_FILE(projectId), lifecycleIndex);
        return { planeIndex, typeIndex, lifecycleIndex, total: activeMats.length };
    }

    async getMaterialsForScene(projectId, scene, chapterNumber) {
        const planeIndex = this._readJson(io.PLANE_INDEX_FILE(projectId));
        const typeIndex = this._readJson(io.TYPE_INDEX_FILE(projectId));
        if (!planeIndex || !typeIndex) {
            await this.rebuildIndex(projectId);
            const result = await this.getMaterialsForScene(projectId, scene, chapterNumber);
            return Array.isArray(result) ? result : [];
        }

        const isInSubplane = scene && scene !== '主世界' && scene !== '';
        const currentSubplaneId = await this._getCurrentSubplaneId(projectId, chapterNumber);
        const idsToLoad = new Set();
        const mainWorld = planeIndex['主世界'] || {};
        for (const type of ['worldview', 'power-system', 'craft', 'writing-technique', 'faction', 'character', 'equipment', 'foreshadowing']) {
            (mainWorld[type] || []).forEach(id => idsToLoad.add(id));
        }
        if (isInSubplane && currentSubplaneId) {
            const subplane = planeIndex[currentSubplaneId] || {};
            for (const type of Object.keys(subplane)) subplane[type].forEach(id => idsToLoad.add(id));
        } else if (currentSubplaneId) {
            const subplane = planeIndex[currentSubplaneId] || {};
            if (subplane['sub-plane']) subplane['sub-plane'].forEach(id => idsToLoad.add(id));
        }

        const materials = [];
        for (const id of idsToLoad) { const m = await store.getItem('materials', id); if (isMaterialActiveAt(m, chapterNumber)) materials.push(m); }
        return materials;
    }

    async getMaterialsByType(projectId, type) {
        const typeIndex = this._readJson(io.TYPE_INDEX_FILE(projectId));
        if (!typeIndex || !typeIndex[type]) return [];
        const materials = [];
        for (const id of typeIndex[type]) { const m = await store.getItem('materials', id); if (isMaterialActiveAt(m, 0)) materials.push(m); }
        return materials;
    }

    async getMaterialsByPlane(projectId, plane) {
        const planeIndex = this._readJson(io.PLANE_INDEX_FILE(projectId));
        if (!planeIndex || !planeIndex[plane]) return [];
        const ids = [];
        for (const type of Object.keys(planeIndex[plane])) planeIndex[plane][type].forEach(id => ids.push(id));
        const materials = [];
        for (const id of ids) { const m = await store.getItem('materials', id); if (isMaterialActiveAt(m, 0)) materials.push(m); }
        return materials;
    }

    async getActiveCharacterNames(projectId) {
        const typeIndex = this._readJson(io.TYPE_INDEX_FILE(projectId));
        if (!typeIndex || !typeIndex['character']) return [];
        const names = [];
        for (const id of typeIndex['character']) { const m = await store.getItem('materials', id); if (isMaterialActiveAt(m, 0)) names.push(m.name); }
        return names;
    }

    async _getCurrentSubplaneId(projectId, chapterNumber) {
        try {
            const _miCtx = await getDataContext(projectId);
            const project = await _miCtx.getProject();
            const genre = project?.genre || project?.styleProfile?.key || '';
            const genreFileMap = { 'causal-eye-strategy': 'volume-order-causal-eye.json', 'strategy-crossplane': 'volume-order-strategy.json', 'witty-strategy': 'volume-order-witty-strategy.json' };
            const fileName = genreFileMap[genre] || 'volume-order.json';
            const volOrder = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'subplanes', fileName), 'utf8'));
            const volume = Math.floor((chapterNumber - 1) / 30) + 1;
            const entry = volOrder.volumeOrder.find(v => v.volume === volume);
            if (entry) return entry.subplaneId;
            const fallbackEntry = volOrder.volumeOrder.find(v => { const match = v.chapters?.match(/Ch(\d+)-(\d+)/); return match && chapterNumber >= parseInt(match[1]) && chapterNumber <= parseInt(match[2]); });
            return fallbackEntry ? fallbackEntry.subplaneId : null;
        } catch (_) { return null; }
    }

    recordDiscovery(projectId, chapterNumber, discovery) { io.recordDiscovery(projectId, chapterNumber, discovery, this._cache, this._cacheTTL); }
    getRecentDiscoveries(projectId, lastN = 5) { return io.getRecentDiscoveries(projectId, lastN, this._cache, this._cacheTTL); }
    removeChapterDiscoveries(projectId, chapterNumber) { io.removeChapterDiscoveries(projectId, chapterNumber, this._cache, this._cacheTTL); }
    getDiscoverySummary(projectId) { return io.getDiscoverySummary(projectId, this._cache, this._cacheTTL); }
    invalidateCache(projectId) { io.invalidateCache(projectId, this._cache); }

    async updateAfterMaterialChange(projectId, chapterNumber, changes) {
        await this.rebuildIndex(projectId);
        const discovery = {};
        if (changes.created?.length > 0) discovery.created = changes.created.map(c => `[${c.type}]${c.name}`);
        if (changes.updated?.length > 0) discovery.updated = changes.updated.map(c => `[${c.type}]${c.name}`);
        if (changes.archived?.length > 0) discovery.archived = changes.archived.map(c => `[${c.type}]${c.name}`);
        if (changes.pending?.length > 0) discovery.pending = changes.pending;
        if (changes.foreshadowProgress?.length > 0) discovery.foreshadowProgress = changes.foreshadowProgress;
        this.recordDiscovery(projectId, chapterNumber, discovery);
    }
}

module.exports = new MaterialIndex();
