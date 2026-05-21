const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let _db = null;
let _SQL = null;
let _dbPath = null;
let _dirty = false;
let _saveTimer = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    parentPlane TEXT,
    parentFaction TEXT,
    archived INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterNumber INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'outlined',
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kv_store (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (type, id)
);

CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(projectId);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type, archived);
CREATE INDEX IF NOT EXISTS idx_materials_parent ON materials(parentPlane, parentFaction);
CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(projectId, chapterNumber);
CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status);
CREATE INDEX IF NOT EXISTS idx_kv_type ON kv_store(type);
`;

const DEDICATED_TABLES = new Set(['materials', 'chapters', 'projects']);

function queryAll(db, sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(db, sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    let result = null;
    if (stmt.step()) {
        result = stmt.getAsObject();
    }
    stmt.free();
    return result;
}

function runSql(db, sql, params = []) {
    if (params.length > 0) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
    } else {
        db.run(sql);
    }
}

function scheduleSave() {
    _dirty = true;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        saveToFile();
    }, 2000);
}

function saveToFile() {
    if (!_db || !_dbPath || _dbPath === ':memory:') return;
    if (!_dirty) return;
    try {
        const data = _db.export();
        const buffer = Buffer.from(data);
        const tmpPath = _dbPath + '.tmp';
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, _dbPath);
        _dirty = false;
    } catch (err) {
        console.error('[DB] Save failed:', err.message);
    }
}

async function initDatabaseAsync(dbPath) {
    if (_db) return _db;

    _dbPath = dbPath || path.join(DATA_DIR, 'novel-pipeline.db');

    if (!_SQL) {
        _SQL = await initSqlJs();
    }

    if (_dbPath !== ':memory:' && fs.existsSync(_dbPath)) {
        const fileBuffer = fs.readFileSync(_dbPath);
        _db = new _SQL.Database(fileBuffer);
    } else {
        _db = new _SQL.Database();
    }

    _db.run('PRAGMA foreign_keys = ON;');
    _db.exec(SCHEMA_SQL);

    return _db;
}

function initDatabase(dbPath) {
    if (_db) return _db;

    _dbPath = dbPath || path.join(DATA_DIR, 'novel-pipeline.db');

    const SQL = require('sql.js');
    if (!_SQL) {
        _SQL = new SQL.Database();
    }

    throw new Error('[DB] Use initDatabaseAsync() for sql.js - it requires async initialization. Call await initDatabaseAsync() before using the store.');
}

function getDatabase() {
    if (!_db) {
        throw new Error('[DB] Database not initialized. Call await initDatabaseAsync() first.');
    }
    return _db;
}

function closeDatabase() {
    if (_db) {
        saveToFile();
        _db.close();
        _db = null;
        _SQL = null;
        _dirty = false;
        if (_saveTimer) {
            clearTimeout(_saveTimer);
            _saveTimer = null;
        }
    }
}

function resetForTesting() {
    if (_db) {
        _db.close();
        _db = null;
    }
    if (!_SQL) {
        throw new Error('[DB] Call initDatabaseAsync() before resetForTesting()');
    }
    _db = new _SQL.Database();
    _db.run('PRAGMA foreign_keys = ON;');
    _db.exec(SCHEMA_SQL);
    _dbPath = ':memory:';
    _dirty = false;
    return _db;
}

function getTableForType(type) {
    if (DEDICATED_TABLES.has(type)) return type;
    return 'kv_store';
}

function safeParse(jsonStr) {
    if (!jsonStr) return null;
    try {
        return JSON.parse(jsonStr);
    } catch (_) {
        return null;
    }
}

function extractMaterialFields(data) {
    return {
        id: data.id,
        projectId: data.projectId || '',
        type: data.type || 'other',
        name: data.name || '',
        parentPlane: data.parentPlane ?? null,
        parentFaction: data.parentFaction ?? null,
        archived: data.archived ? 1 : 0,
        data: JSON.stringify(data)
    };
}

function extractChapterFields(data) {
    return {
        id: data.id,
        projectId: data.projectId || '',
        chapterNumber: data.chapterNumber || 0,
        status: data.status || 'outlined',
        data: JSON.stringify(data)
    };
}

function extractProjectFields(data) {
    return {
        id: data.id,
        data: JSON.stringify(data)
    };
}

function extractKvFields(type, data) {
    return {
        type,
        id: data.id,
        data: JSON.stringify(data)
    };
}

function queryMaterialsByProject(projectId, options = {}) {
    const db = getDatabase();
    let sql = 'SELECT data FROM materials WHERE projectId = ?';
    const params = [projectId];

    if (options.type) {
        sql += ' AND type = ?';
        params.push(options.type);
    }
    if (options.archived === false) {
        sql += ' AND archived = 0';
    }
    if (options.parentPlane) {
        sql += ' AND parentPlane = ?';
        params.push(options.parentPlane);
    }

    return queryAll(db, sql, params).map(r => safeParse(r.data)).filter(Boolean);
}

function queryChaptersByProject(projectId, options = {}) {
    const db = getDatabase();
    let sql = 'SELECT data FROM chapters WHERE projectId = ?';
    const params = [projectId];

    if (options.status) {
        sql += ' AND status = ?';
        params.push(options.status);
    }

    sql += ' ORDER BY chapterNumber ASC';

    return queryAll(db, sql, params).map(r => safeParse(r.data)).filter(Boolean);
}

function queryKvByType(type, filter = {}) {
    const db = getDatabase();
    if (!filter || Object.keys(filter).length === 0) {
        return queryAll(db, 'SELECT data FROM kv_store WHERE type = ?', [type])
            .map(r => safeParse(r.data)).filter(Boolean);
    }
    return queryAll(db, 'SELECT data FROM kv_store WHERE type = ?', [type])
        .map(r => safeParse(r.data))
        .filter(item => {
            if (!item) return false;
            return Object.keys(filter).every(key => item[key] === filter[key]);
        });
}

function countItemsByType(type) {
    const db = getDatabase();
    const table = getTableForType(type);
    if (table === 'kv_store') {
        const row = queryOne(db, 'SELECT COUNT(*) as cnt FROM kv_store WHERE type = ?', [type]);
        return row ? row.cnt : 0;
    }
    const row = queryOne(db, `SELECT COUNT(*) as cnt FROM ${table}`);
    return row ? row.cnt : 0;
}

module.exports = {
    initDatabaseAsync,
    initDatabase,
    getDatabase,
    closeDatabase,
    resetForTesting,
    saveToFile,
    scheduleSave,
    getTableForType,
    safeParse,
    queryAll,
    queryOne,
    runSql,
    extractMaterialFields,
    extractChapterFields,
    extractProjectFields,
    extractKvFields,
    queryMaterialsByProject,
    queryChaptersByProject,
    queryKvByType,
    countItemsByType,
    DEDICATED_TABLES,
    DATA_DIR
};
