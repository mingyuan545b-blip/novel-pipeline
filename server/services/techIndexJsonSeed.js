/**
 * techIndexJsonSeed — 藏经阁JSON种子加载（PG不可用时的兜底 + 首次迁移源）
 *
 * 历史遗留：藏经阁原为 server/data/library/ 下 index.json + leaf/*.json + metadata/*.json。
 * 迁到PG后本模块只作两用：
 *   1) PG读取失败/为空时兜底，保证Pipeline不会因存储异常而失去技法注入
 *   2) migrateLibraryToPg.js 的源数据读取复用
 * 文件位置：server/services/techIndexJsonSeed.js
 */
const fs = require('fs');
const path = require('path');

const LIBRARY_DIR = path.join(__dirname, '..', 'data', 'library');

function readJson(fp) {
    return JSON.parse(fs.readFileSync(fp, 'utf-8').replace(/^\uFEFF/, ''));
}

function dirExists() {
    return fs.existsSync(path.join(LIBRARY_DIR, 'index.json'));
}

/**
 * 读取全部技法（合并 index + leaf + metadata 为单条记录）
 * @returns {Array} 技法记录（字段与 libraryStore.normalize 对齐）
 */
function loadAll() {
    const idxPath = path.join(LIBRARY_DIR, 'index.json');
    if (!fs.existsSync(idxPath)) return [];
    const index = readJson(idxPath);
    const records = [];
    for (const entry of index.entries || []) {
        const leafPath = path.join(LIBRARY_DIR, entry.path);
        if (!fs.existsSync(leafPath)) continue;
        let leaf;
        try { leaf = readJson(leafPath); } catch (_) { continue; }
        const metaPath = path.join(LIBRARY_DIR, 'metadata', `${entry.id}.json`);
        let meta = {};
        if (fs.existsSync(metaPath)) { try { meta = readJson(metaPath); } catch (_) { meta = {}; } }
        records.push({
            ...leaf,
            subcategory: leaf.subcategory || entry.subcategory || '',
            worldviewDepth: leaf.worldviewDepth || entry.worldviewDepth || 'meso',
            success_rate: meta.success_rate ?? 50,
            attempts: meta.attempts ?? 0,
            auto_disabled: meta.auto_disabled ?? false,
        });
    }
    return records;
}

module.exports = { loadAll, dirExists, LIBRARY_DIR };
