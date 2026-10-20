const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

const INDEX_DIR = path.join(__dirname, '..', '..', 'data', 'material-index');
const DISCOVERY_DIR = path.join(INDEX_DIR, 'discoveries');
const MAX_DISCOVERY_CHAPTERS = 10;

try { fs.mkdirSync(INDEX_DIR, { recursive: true }); } catch(_) { logger.warn('materialIndex', _.message || _); }  // DEGRADE: 影响=fs.mkdirSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
try { fs.mkdirSync(DISCOVERY_DIR, { recursive: true }); } catch(_) { logger.warn('materialIndex', _.message || _); }  // DEGRADE: 影响=fs.mkdirSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

const PLANE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-planes.json`);
const TYPE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-types.json`);
const DISCOVERY_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-discoveries.json`);
const LIFECYCLE_INDEX_FILE = (projectId) => path.join(INDEX_DIR, `${projectId}-lifecycle.json`);

function readJson(filePath, cache, cacheTTL) {
    const cacheKey = filePath;
    if (cache[cacheKey] && Date.now() - cache[cacheKey]._ts < cacheTTL) return cache[cacheKey].data;
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        cache[cacheKey] = { data, _ts: Date.now() };
        return data;
    } catch (_) { return null; }
}

function writeJson(filePath, data, cache) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    cache[filePath] = { data, _ts: Date.now() };
}

function recordDiscovery(projectId, chapterNumber, discovery, cache, cacheTTL) {
    const indexPath = DISCOVERY_INDEX_FILE(projectId);
    let index = readJson(indexPath, cache, cacheTTL) || { chapters: [], lastUpdated: null };
    const existing = index.chapters.find(c => c.chapter === chapterNumber);
    if (existing) { Object.assign(existing, discovery, { updatedAt: new Date().toISOString() }); }
    else { index.chapters.push({ chapter: chapterNumber, ...discovery, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
    index.chapters.sort((a, b) => a.chapter - b.chapter);
    if (index.chapters.length > MAX_DISCOVERY_CHAPTERS) {
        const archived = index.chapters.slice(0, index.chapters.length - MAX_DISCOVERY_CHAPTERS);
        for (const ch of archived) {
            const archivePath = path.join(DISCOVERY_DIR, `${projectId}-ch${ch.chapter}.json`);
            try { fs.writeFileSync(archivePath, JSON.stringify(ch, null, 2), 'utf8'); } catch(_) { logger.warn('materialIndex', _.message || _); }  // DEGRADE: 影响=fs.writeFileSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        }
        index.chapters = index.chapters.slice(-MAX_DISCOVERY_CHAPTERS);
    }
    index.lastUpdated = new Date().toISOString();
    writeJson(indexPath, index, cache);
}

function getRecentDiscoveries(projectId, lastN, cache, cacheTTL) {
    const index = readJson(DISCOVERY_INDEX_FILE(projectId), cache, cacheTTL);
    if (!index || !index.chapters) return [];
    return index.chapters.slice(-lastN);
}

function removeChapterDiscoveries(projectId, chapterNumber, cache, cacheTTL) {
    const indexPath = DISCOVERY_INDEX_FILE(projectId);
    const index = readJson(indexPath, cache, cacheTTL);
    if (!index || !index.chapters) return;
    index.chapters = index.chapters.filter(ch => ch.chapter !== chapterNumber);
    index.lastUpdated = new Date().toISOString();
    writeJson(indexPath, index, cache);
    const archivePath = path.join(DISCOVERY_DIR, `${projectId}-ch${chapterNumber}.json`);
    try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch(_) { logger.warn('materialIndex', _.message || _); }  // DEGRADE: 影响=if 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

function getDiscoverySummary(projectId, cache, cacheTTL) {
    const discoveries = getRecentDiscoveries(projectId, MAX_DISCOVERY_CHAPTERS, cache, cacheTTL);
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

function invalidateCache(projectId, cache) {
    const files = [PLANE_INDEX_FILE(projectId), TYPE_INDEX_FILE(projectId), DISCOVERY_INDEX_FILE(projectId), LIFECYCLE_INDEX_FILE(projectId)];
    for (const f of files) delete cache[f];
}

module.exports = {
    INDEX_DIR, DISCOVERY_DIR, MAX_DISCOVERY_CHAPTERS,
    PLANE_INDEX_FILE, TYPE_INDEX_FILE, DISCOVERY_INDEX_FILE, LIFECYCLE_INDEX_FILE,
    readJson, writeJson, recordDiscovery, getRecentDiscoveries,
    removeChapterDiscoveries, getDiscoverySummary, invalidateCache
};
