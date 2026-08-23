const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const genresDir = path.join(__dirname, 'genres');
const SKIP_ENTRIES = new Set(['baseGenreTemplate.js', 'genrePluginSpec.js']);

let GENRE_REGISTRY = null;
let genreMap = null;

function _loadSingleGenre(entryPath, genreId) {
    try {
        delete require.cache[require.resolve(entryPath)];
    } catch (_) { /* first load, no cache */ }
    try {
        const genre = require(entryPath);
        if (genre && genre.id && typeof genre.isMatch === 'function') {
            return genre;
        }
    } catch (e) {
        logger.error('genreLoader', `Failed to load genre from ${entryPath}: ${e.message}`);
    }
    return null;
}

function loadAllGenres() {
    const registry = [];
    const map = {};

    if (!fs.existsSync(genresDir)) {
        logger.warn('genreLoader', `Genres directory not found: ${genresDir}`);
        return { registry, map };
    }

    for (const entry of fs.readdirSync(genresDir)) {
        const entryPath = path.join(genresDir, entry);
        let stat;
        try { stat = fs.statSync(entryPath); } catch (_) { continue; }

        if (stat.isDirectory()) {
            const indexPath = path.join(entryPath, 'index.js');
            if (fs.existsSync(indexPath)) {
                const genre = _loadSingleGenre(indexPath, entry);
                if (genre) {
                    registry.push(genre);
                    map[genre.id] = genre;
                    // 目录名别名：目录名可能与插件id不一致（如high-martial-crossplane目录→id为high-martial-comedy）
                    // 建立目录名→插件的映射，确保getGenreById(目录名)也能找到插件
                    if (entry !== genre.id) {
                        map[entry] = genre;
                    }
                }
            }
            continue;
        }

        if (!entry.endsWith('.js') || SKIP_ENTRIES.has(entry) || entry.startsWith('_')) continue;
        const genreId = entry.replace('.js', '');
        if (fs.existsSync(path.join(genresDir, genreId))) continue;
        const genre = _loadSingleGenre(entryPath, genreId);
        if (genre) { registry.push(genre); map[genre.id] = genre; }
    }

    return { registry, map };
}

function _ensureLoaded() {
    if (GENRE_REGISTRY === null) {
        const result = loadAllGenres();
        GENRE_REGISTRY = result.registry;
        genreMap = result.map;
        logger.info('genreLoader', `Lazy-loaded ${GENRE_REGISTRY.length} genres`);
    }
}

function reloadGenres() {
    const result = loadAllGenres();
    GENRE_REGISTRY = result.registry;
    genreMap = result.map;
    logger.info('genreLoader', `Reloaded ${GENRE_REGISTRY.length} genres`);
    return GENRE_REGISTRY.length;
}

function getRegistry() { _ensureLoaded(); return GENRE_REGISTRY; }
function getMap() { _ensureLoaded(); return genreMap; }
function getGenreDir() { return genresDir; }

module.exports = { getRegistry, getMap, reloadGenres, loadAllGenres, getGenreDir };
