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

function _getDeps() {
    // Lazy require to avoid circular dependency with database.js
    return require('./database');
}

function queryMaterialsByProject(projectId, options = {}) {
    const { getDatabase, queryAll } = _getDeps();
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
    const { getDatabase, queryAll } = _getDeps();
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
    const { getDatabase, queryAll } = _getDeps();
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
    const { getDatabase, getTableForType, queryOne } = _getDeps();
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
    extractMaterialFields,
    extractChapterFields,
    extractProjectFields,
    extractKvFields,
    queryMaterialsByProject,
    queryChaptersByProject,
    queryKvByType,
    countItemsByType
};
