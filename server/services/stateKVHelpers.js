const logger = require('../shared/logger');
const store = require('../store');
const { getCharacterStateSchema, formatStateForPrompt, buildLabelToKeyMap } = require('../config/characterStateSchemas');
const { detectGenre, getGenreById } = require('./genreConfig');

const KV_STORE_TYPE = 'state-kv-index';
const STATE_STORE_TYPE = 'character-states';
const HOT_WINDOW = 5;

function _hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36);
}

function _makeKVId(projectId, scope, entityKey, dataKey) {
    const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '');
    const entityPart = /^[a-zA-Z0-9_-]+$/.test(entityKey) ? entityKey : `h${_hashStr(entityKey)}`;
    const dataPart = /^[a-zA-Z0-9_-]+$/.test(dataKey) ? dataKey : `h${_hashStr(dataKey)}`;
    return `kv-${safeProjectId}-${safeScope}-${entityPart}-${dataPart}`;
}

function _makeStateId(characterId, chapterNumber) {
    return `cs-${characterId}-ch${chapterNumber}`;
}

function _inferType(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

// 兜底（题材未登记）：只取**与题材无关**的身份/叙事字段。
// 修复：原兜底含 hp/combatPower，会把战斗/游戏字段注入任何题材（古代账目世界也会出现"血量/战力"）。
const GENRE_NEUTRAL_KEYS = ['name', 'position', 'factionName', 'speakingTone', 'personality', 'signatureDetail'];

function getGenreImportantKeys(genreId) {
    try {
        const genre = getGenreById(genreId);
        if (genre?.kvImportantKeys?.length) return genre.kvImportantKeys;
    } catch (_) { logger.warn('stateKVHelpers', '[state-kv]', _.message || _); }  // DEGRADE: 影响=getGenreById 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    const GENRE_DEFAULTS = {
        'high-martial-comedy': ['name', 'hp', 'combatPower', 'cultivationStage', 'currentPlane', 'factionName'],
        'baby': ['name', 'hp', 'affectionLevel', 'relationshipStatus', 'guardianStatus'],
    };
    if (GENRE_DEFAULTS[genreId]) return GENRE_DEFAULTS[genreId];
    return GENRE_NEUTRAL_KEYS;
}

function _deserializeValue(item) {
    if (item.dataType === 'number') return Number(item.dataValue);
    if (item.dataType === 'boolean') return item.dataValue === 'true';
    if (item.dataType === 'array' || item.dataType === 'object') {
        try { return JSON.parse(item.dataValue); } catch { return item.dataValue; }
    }
    return item.dataValue;
}

async function getCurrentChapter(projectId) {
    const id = `meta-${projectId}-currentChapter`;
    const meta = await store.getItem('state-meta', id);
    if (meta?.currentChapter) return meta.currentChapter;
    try {
        const project = await store.getItem('projects', projectId);
        if (project?.currentChapter && project.currentChapter > 0) return project.currentChapter;
    } catch (_) { /* fallback */ }
    try {
        const chapters = await store.queryItems('chapters', { projectId });
        if (chapters.length > 0) {
            const maxCh = Math.max(...chapters.map(c => c.chapterNumber || 0));
            if (maxCh > 0) return maxCh;
        }
    } catch (_) { /* fallback */ }
    return 1;
}

module.exports = {
    KV_STORE_TYPE, STATE_STORE_TYPE, HOT_WINDOW,
    _hashStr, _makeKVId, _makeStateId, _inferType,
    getGenreImportantKeys, _deserializeValue, getCurrentChapter
};
