/**
 * SQLite query helpers and field extractors.
 * Pure utility functions with no side effects or state.
 */

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

function safeParse(jsonStr) {
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch (_) { return null; }
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
    return { id: data.id, data: JSON.stringify(data) };
}

function extractKvFields(type, data) {
    return { type, id: data.id, data: JSON.stringify(data) };
}

module.exports = {
    queryAll, queryOne, runSql, safeParse,
    extractMaterialFields, extractChapterFields,
    extractProjectFields, extractKvFields
};
