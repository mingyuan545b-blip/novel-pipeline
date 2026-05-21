const store = require('../store');
const fs = require('fs');
const path = require('path');

const INDEX_DIR = path.join(__dirname, '..', '..', 'data', 'material-index');
const DISCOVERY_DIR = path.join(INDEX_DIR, 'discoveries');

try { fs.mkdirSync(INDEX_DIR, { recursive: true }); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
try { fs.mkdirSync(DISCOVERY_DIR, { recursive: true }); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

const PLANE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-planes.json`);
const TYPE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-types.json`);
const DISCOVERY_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-discoveries.json`);
const LIFECYCLE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-lifecycle.json`);

const MAX_DISCOVERY_CHAPTERS = 10;

class MaterialIndex {
    constructor() {
        this._cache = {};
        this._cacheTTL = 30000;
        this._cacheTimers = {};
    }

    _readJson(filePath) {
        const cacheKey = filePath;
        if (this._cache[cacheKey] && Date.now() - this._cache[cacheKey]._ts < this._cacheTTL) {
            return this._cache[cacheKey].data;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this._cache[cacheKey] = { data, _ts: Date.now() };
            return data;
        } catch (_) {
            return null;
        }
    }

    _writeJson(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        this._cache[filePath] = { data, _ts: Date.now() };
    }

    rebuildIndex(projectId) {
        const materials = store.queryItems('materials', { projectId });
        const activeMats = materials.filter(m => !m.archived);

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

        this._writeJson(PLANE_INDEX_FILE(projectId), planeIndex);
        this._writeJson(TYPE_INDEX_FILE(projectId), typeIndex);
        this._writeJson(LIFECYCLE_INDEX_FILE(projectId), lifecycleIndex);

        return { planeIndex, typeIndex, lifecycleIndex, total: activeMats.length };
    }

    _getLifecycle(m) {
        const PERMANENT_TYPES = new Set(['worldview', 'power-system', 'sub-plane', 'craft', 'writing-technique']);
        const EPHEMERAL_TYPES = new Set(['mechanism', 'location', 'catchphrase', 'famous-scene', 'index', 'other', 'narrative-bridge']);
        if (PERMANENT_TYPES.has(m.type)) return 'permanent';
        if (EPHEMERAL_TYPES.has(m.type)) return 'ephemeral';
        if (!m.parentPlane || m.parentPlane === '主世界') return 'permanent';
        if (m.type === 'character' || m.type === 'faction') return 'semiPermanent';
        if (m.type === 'equipment' && m.name && m.name.includes('主角')) return 'semiPermanent';
        return 'ephemeral';
    }

    getMaterialsForScene(projectId, scene, chapterNumber) {
        const planeIndex = this._readJson(PLANE_INDEX_FILE(projectId));
        const typeIndex = this._readJson(TYPE_INDEX_FILE(projectId));
        if (!planeIndex || !typeIndex) {
            this.rebuildIndex(projectId);
            return this.getMaterialsForScene(projectId, scene, chapterNumber);
        }

        const isInSubplane = scene && scene !== '主世界' && scene !== '';
        const currentSubplaneId = this._getCurrentSubplaneId(projectId, chapterNumber);

        const idsToLoad = new Set();

        const mainWorld = planeIndex['主世界'] || {};
        for (const type of ['worldview', 'power-system', 'craft', 'writing-technique', 'faction', 'character', 'equipment', 'foreshadowing']) {
            const ids = mainWorld[type] || [];
            ids.forEach(id => idsToLoad.add(id));
        }

        if (isInSubplane && currentSubplaneId) {
            const subplane = planeIndex[currentSubplaneId] || {};
            for (const type of Object.keys(subplane)) {
                subplane[type].forEach(id => idsToLoad.add(id));
            }
        } else if (currentSubplaneId) {
            const subplane = planeIndex[currentSubplaneId] || {};
            if (subplane['sub-plane']) subplane['sub-plane'].forEach(id => idsToLoad.add(id));
        }

        const materials = [];
        for (const id of idsToLoad) {
            const m = store.getItem('materials', id);
            if (m && !m.archived) materials.push(m);
        }

        return materials;
    }

    getMaterialsByType(projectId, type) {
        const typeIndex = this._readJson(TYPE_INDEX_FILE(projectId));
        if (!typeIndex || !typeIndex[type]) return [];

        const materials = [];
        for (const id of typeIndex[type]) {
            const m = store.getItem('materials', id);
            if (m && !m.archived) materials.push(m);
        }
        return materials;
    }

    getMaterialsByPlane(projectId, plane) {
        const planeIndex = this._readJson(PLANE_INDEX_FILE(projectId));
        if (!planeIndex || !planeIndex[plane]) return [];

        const ids = [];
        for (const type of Object.keys(planeIndex[plane])) {
            planeIndex[plane][type].forEach(id => ids.push(id));
        }

        const materials = [];
        for (const id of ids) {
            const m = store.getItem('materials', id);
            if (m && !m.archived) materials.push(m);
        }
        return materials;
    }

    getActiveCharacterNames(projectId) {
        const typeIndex = this._readJson(TYPE_INDEX_FILE(projectId));
        if (!typeIndex || !typeIndex['character']) return [];

        const names = [];
        for (const id of typeIndex['character']) {
            const m = store.getItem('materials', id);
            if (m && !m.archived) names.push(m.name);
        }
        return names;
    }

    _getCurrentSubplaneId(projectId, chapterNumber) {
        try {
            const project = store.getItem('projects', projectId);
            const genre = project?.genre || project?.styleProfile?.key || '';
            const genreFileMap = {
                'causal-eye-strategy': 'volume-order-causal-eye.json',
                'strategy-crossplane': 'volume-order-strategy.json',
                'witty-strategy': 'volume-order-witty-strategy.json',
            };
            const fileName = genreFileMap[genre] || 'volume-order.json';
            const volOrder = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'subplanes', fileName), 'utf8'));
            const volume = Math.floor((chapterNumber - 1) / 30) + 1;
            const entry = volOrder.volumeOrder.find(v => v.volume === volume);
            if (entry) return entry.subplaneId;
            const fallbackEntry = volOrder.volumeOrder.find(v => {
                const match = v.chapters?.match(/Ch(\d+)-(\d+)/);
                return match && chapterNumber >= parseInt(match[1]) && chapterNumber <= parseInt(match[2]);
            });
            return fallbackEntry ? fallbackEntry.subplaneId : null;
        } catch (_) { return null; }
    }

    recordDiscovery(projectId, chapterNumber, discovery) {
        const indexPath = DISCOVERY_INDEX_FILE(projectId);
        let index = this._readJson(indexPath) || { chapters: [], lastUpdated: null };

        const existing = index.chapters.find(c => c.chapter === chapterNumber);
        if (existing) {
            Object.assign(existing, discovery, { updatedAt: new Date().toISOString() });
        } else {
            index.chapters.push({
                chapter: chapterNumber,
                ...discovery,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        index.chapters.sort((a, b) => a.chapter - b.chapter);

        if (index.chapters.length > MAX_DISCOVERY_CHAPTERS) {
            const archived = index.chapters.slice(0, index.chapters.length - MAX_DISCOVERY_CHAPTERS);
            for (const ch of archived) {
                const archivePath = path.join(DISCOVERY_DIR, `${projectId}-ch${ch.chapter}.json`);
                try { fs.writeFileSync(archivePath, JSON.stringify(ch, null, 2), 'utf8'); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            }
            index.chapters = index.chapters.slice(-MAX_DISCOVERY_CHAPTERS);
        }

        index.lastUpdated = new Date().toISOString();
        this._writeJson(indexPath, index);
    }

    getRecentDiscoveries(projectId, lastN = 5) {
        const index = this._readJson(DISCOVERY_INDEX_FILE(projectId));
        if (!index || !index.chapters) return [];
        return index.chapters.slice(-lastN);
    }

    removeChapterDiscoveries(projectId, chapterNumber) {
        const indexPath = DISCOVERY_INDEX_FILE(projectId);
        const index = this._readJson(indexPath);
        if (!index || !index.chapters) return;
        index.chapters = index.chapters.filter(ch => ch.chapter !== chapterNumber);
        index.lastUpdated = new Date().toISOString();
        this._writeJson(indexPath, index);
        const archivePath = path.join(DISCOVERY_DIR, `${projectId}-ch${chapterNumber}.json`);
        try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    getDiscoverySummary(projectId) {
        const discoveries = this.getRecentDiscoveries(projectId, MAX_DISCOVERY_CHAPTERS);
        if (discoveries.length === 0) return '';

        const lines = ['【近期章节发现记录】'];
        for (const d of discoveries) {
            lines.push(`\nCh${d.chapter}:`);
            if (d.created && d.created.length > 0) lines.push(`  新发现: ${d.created.join('、')}`);
            if (d.updated && d.updated.length > 0) lines.push(`  有变化: ${d.updated.join('、')}`);
            if (d.pending && d.pending.length > 0) lines.push(`  待处理: ${d.pending.join('、')}`);
            if (d.foreshadowProgress && d.foreshadowProgress.length > 0) lines.push(`  伏笔: ${d.foreshadowProgress.join('、')}`);
        }
        return lines.join('\n');
    }

    updateAfterMaterialChange(projectId, chapterNumber, changes) {
        this.rebuildIndex(projectId);

        const discovery = {};
        if (changes.created && changes.created.length > 0) {
            discovery.created = changes.created.map(c => `[${c.type}]${c.name}`);
        }
        if (changes.updated && changes.updated.length > 0) {
            discovery.updated = changes.updated.map(c => `[${c.type}]${c.name}`);
        }
        if (changes.archived && changes.archived.length > 0) {
            discovery.archived = changes.archived.map(c => `[${c.type}]${c.name}`);
        }
        if (changes.pending && changes.pending.length > 0) {
            discovery.pending = changes.pending;
        }
        if (changes.foreshadowProgress && changes.foreshadowProgress.length > 0) {
            discovery.foreshadowProgress = changes.foreshadowProgress;
        }

        this.recordDiscovery(projectId, chapterNumber, discovery);
    }

    invalidateCache(projectId) {
        const files = [
            PLANE_INDEX_FILE(projectId),
            TYPE_INDEX_FILE(projectId),
            DISCOVERY_INDEX_FILE(projectId),
            LIFECYCLE_INDEX_FILE(projectId)
        ];
        for (const f of files) {
            delete this._cache[f];
        }
    }
}

const materialIndex = new MaterialIndex();
module.exports = materialIndex;
