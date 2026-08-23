const { getPool } = require('./pgPool');
const { safeParse } = require('./pgCore');
const { DEDICATED_TABLES, TABLE_ALIASES } = require('./pgConstants');

function getTableForType(type) {
    const resolved = TABLE_ALIASES[type] || type;
    if (DEDICATED_TABLES.has(resolved)) return resolved;
    return 'kv_store';
}

async function queryMaterialsByProject(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM materials WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.type) { paramIdx++; sql += ` AND type = $${paramIdx}`; params.push(options.type); }
    if (options.archived === false) { sql += ' AND archived = false'; }
    if (options.parentPlane) { paramIdx++; sql += ` AND parentPlane = $${paramIdx}`; params.push(options.parentPlane); }
    if (options.roleLevel) { paramIdx++; sql += ` AND roleLevel = $${paramIdx}`; params.push(options.roleLevel); }
    if (options.currentStatus) { paramIdx++; sql += ` AND currentStatus = $${paramIdx}`; params.push(options.currentStatus); }
    if (options.lastAppearChapter) { paramIdx++; sql += ` AND lastAppearChapter >= $${paramIdx}`; params.push(options.lastAppearChapter); }
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryMaterialsByProject')).filter(Boolean);
}

async function queryChaptersByProject(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM chapters WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.status) { paramIdx++; sql += ` AND status = $${paramIdx}`; params.push(options.status); }
    sql += ' ORDER BY chapterNumber ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryChaptersByProject')).filter(Boolean);
}

async function queryKvByType(type, filter = {}) {
    const pool = getPool();
    if (!filter || Object.keys(filter).length === 0) {
        const result = await pool.query('SELECT data FROM kv_store WHERE type = $1', [type]);
        return result.rows.map(r => safeParse(r.data, 'queryKvByType')).filter(Boolean);
    }
    const result = await pool.query('SELECT data FROM kv_store WHERE type = $1', [type]);
    return result.rows.map(r => safeParse(r.data, 'queryKvByType-filter')).filter(item => {
        if (!item) return false;
        return Object.keys(filter).every(key => item[key] === filter[key]);
    });
}

async function queryCharacterStates(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM character_states WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.characterId) { paramIdx++; sql += ` AND characterId = $${paramIdx}`; params.push(options.characterId); }
    if (options.chapterNumber !== undefined) { paramIdx++; sql += ` AND chapterNumber = $${paramIdx}`; params.push(options.chapterNumber); }
    sql += ' ORDER BY chapterNumber ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryCharacterStates')).filter(Boolean);
}

async function queryStateKvIndex(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM state_kv_index WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.scope) { paramIdx++; sql += ` AND scope = $${paramIdx}`; params.push(options.scope); }
    if (options.entityKey) { paramIdx++; sql += ` AND entityKey = $${paramIdx}`; params.push(options.entityKey); }
    if (options.isHot !== undefined) { paramIdx++; sql += ` AND isHot = $${paramIdx}`; params.push(options.isHot ? true : false); }
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryStateKvIndex')).filter(Boolean);
}

async function queryCharacterStateCache(projectId, chapterNumber, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM character_state_cache WHERE projectId = $1 AND chapterNumber = $2 AND isValid = true';
    const params = [projectId, chapterNumber];
    let paramIdx = 2;
    if (options.roleLevel) { paramIdx++; sql += ` AND roleLevel = $${paramIdx}`; params.push(options.roleLevel); }
    if (options.characterId) { paramIdx++; sql += ` AND characterId = $${paramIdx}`; params.push(options.characterId); }
    sql += ' ORDER BY roleLevel ASC, characterId ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryCharacterStateCache')).filter(Boolean);
}

async function countItemsByType(type) {
    const pool = getPool();
    const table = getTableForType(type);
    if (table === 'kv_store') {
        const result = await pool.query('SELECT COUNT(*) as cnt FROM kv_store WHERE type = $1', [type]);
        return parseInt(result.rows[0].cnt, 10);
    }
    const result = await pool.query(`SELECT COUNT(*) as cnt FROM ${table}`);
    return parseInt(result.rows[0].cnt, 10);
}

module.exports = {
    queryMaterialsByProject, queryChaptersByProject, queryKvByType,
    queryCharacterStates, queryStateKvIndex, queryCharacterStateCache,
    countItemsByType
};
