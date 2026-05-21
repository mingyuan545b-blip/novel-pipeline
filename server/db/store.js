const { getDatabase, getTableForType, safeParse, extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields, scheduleSave, DEDICATED_TABLES, queryAll, queryOne, runSql, queryMaterialsByProject: queryMaterialsByProjectDB, queryChaptersByProject: queryChaptersByProjectDB, queryKvByType, countItemsByType } = require('./database');
const { STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING } = require('../config/systemConfig');
const { CRAFT_TYPES } = require('../config/materialTypes');

function trimItemData(type, data) {
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
    let serialized = JSON.stringify(data, null, 2);

    if (serialized.length <= maxSize) return data;

    if (type === 'chapters' && data.history) {
        data.history = data.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
        const truncFields = {
            writerOutput: STORE_TRIMMING.outputTruncateLength,
            firstReviewOutput: STORE_TRIMMING.outputTruncateLength,
            secondReviewOutput: STORE_TRIMMING.outputTruncateLength,
            finalEditorOutput: STORE_TRIMMING.outputTruncateLength,
            materialManagerOutput: STORE_TRIMMING.outputTruncateLength,
            readerOutput: STORE_TRIMMING.readerOutputTruncate,
            adjusterOutput: STORE_TRIMMING.adjusterOutputTruncate,
            reviserOutput: STORE_TRIMMING.outputTruncateLength,
            reviserOutputRaw: STORE_TRIMMING.outputTruncateLength,
            polisherOutput: STORE_TRIMMING.outputTruncateLength
        };
        for (const [field, maxLen] of Object.entries(truncFields)) {
            if (data[field] && data[field].length > maxLen) {
                data[field] = data[field].substring(0, maxLen) + '\n...[truncated]';
            }
        }
    }

    if (type === 'materials' && data.changeLog && data.changeLog.length > STORE_TRIMMING.materialChangeLogKeep) {
        data.changeLog = data.changeLog.slice(-STORE_TRIMMING.materialChangeLogKeep);
    }

    if (type === 'projects') {
        if (data.chapters && data.chapters.length > STORE_TRIMMING.projectChaptersKeep) {
            data.chapters = data.chapters.slice(-STORE_TRIMMING.projectChaptersKeep);
        }
        if (data.chapterIntents?.chapters && data.chapterIntents.chapters.length > STORE_TRIMMING.projectChapterIntentsKeep) {
            data.chapterIntents.chapters = data.chapterIntents.chapters.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
        }
        if (data.description && data.description.length > STORE_TRIMMING.projectDescriptionMaxLength) {
            data.description = data.description.substring(0, STORE_TRIMMING.projectDescriptionMaxLength);
        }
    }

    return data;
}

function listItems(type) {
    const db = getDatabase();
    const table = getTableForType(type);

    let rows;
    if (table === 'kv_store') {
        rows = queryAll(db, 'SELECT data FROM kv_store WHERE type = ?', [type]);
    } else {
        rows = queryAll(db, `SELECT data FROM ${table}`);
    }

    return rows.map(r => safeParse(r.data)).filter(Boolean);
}

function getItem(type, id) {
    const db = getDatabase();
    const table = getTableForType(type);

    let row;
    if (table === 'kv_store') {
        row = queryOne(db, 'SELECT data FROM kv_store WHERE type = ? AND id = ?', [type, id]);
    } else {
        row = queryOne(db, `SELECT data FROM ${table} WHERE id = ?`, [id]);
    }

    if (!row) return null;
    return safeParse(row.data);
}

function setItem(type, id, data) {
    const db = getDatabase();
    const table = getTableForType(type);

    data = trimItemData(type, { ...data });
    if (!data.id) data.id = id;

    const now = new Date().toISOString();
    const existing = getItem(type, id);
    if (existing && existing.createdAt) {
        data.createdAt = existing.createdAt;
    } else if (!data.createdAt) {
        data.createdAt = now;
    }
    data.updatedAt = now;

    try {
        if (table === 'materials') {
            const f = extractMaterialFields(data);
            const existing = queryOne(db, 'SELECT id FROM materials WHERE id = ?', [id]);
            if (existing) {
                runSql(db, `UPDATE materials SET projectId=?, type=?, name=?, parentPlane=?, parentFaction=?, archived=?, data=?, updatedAt=? WHERE id=?`,
                    [f.projectId, f.type, f.name, f.parentPlane, f.parentFaction, f.archived, f.data, data.updatedAt, id]);
            } else {
                runSql(db, `INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.type, f.name, f.parentPlane, f.parentFaction, f.archived, f.data, data.createdAt, data.updatedAt]);
            }
        } else if (table === 'chapters') {
            const f = extractChapterFields(data);
            const existing = queryOne(db, 'SELECT id FROM chapters WHERE id = ?', [id]);
            if (existing) {
                runSql(db, `UPDATE chapters SET projectId=?, chapterNumber=?, status=?, data=?, updatedAt=? WHERE id=?`,
                    [f.projectId, f.chapterNumber, f.status, f.data, data.updatedAt, id]);
            } else {
                runSql(db, `INSERT INTO chapters (id, projectId, chapterNumber, status, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
                    [f.id, f.projectId, f.chapterNumber, f.status, f.data, data.createdAt, data.updatedAt]);
            }
        } else if (table === 'projects') {
            const f = extractProjectFields(data);
            const existing = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id]);
            if (existing) {
                runSql(db, `UPDATE projects SET data=?, updatedAt=? WHERE id=?`,
                    [f.data, data.updatedAt, id]);
            } else {
                runSql(db, `INSERT INTO projects (id, data, createdAt, updatedAt) VALUES (?,?,?,?)`,
                    [f.id, f.data, data.createdAt, data.updatedAt]);
            }
        } else {
            const f = extractKvFields(type, data);
            const existing = queryOne(db, 'SELECT id FROM kv_store WHERE type = ? AND id = ?', [type, id]);
            if (existing) {
                runSql(db, `UPDATE kv_store SET data=?, updatedAt=? WHERE type=? AND id=?`,
                    [f.data, data.updatedAt, type, id]);
            } else {
                runSql(db, `INSERT INTO kv_store (type, id, data, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
                    [f.type, f.id, f.data, data.createdAt, data.updatedAt]);
            }
        }

        scheduleSave();
    } catch (err) {
        console.error(`[STORE] SQLite write error for ${type}/${id}:`, err.message);
        throw err;
    }

    return data;
}

function deleteItem(type, id) {
    if (type === 'materials') {
        const item = getItem(type, id);
        if (item && isFoundationMaterial(item)) {
            console.warn(`[STORE] Blocked deletion of foundation material: ${id} (${item.name})`);
            return false;
        }
    }

    const db = getDatabase();
    const table = getTableForType(type);

    try {
        let existed = false;
        if (table === 'kv_store') {
            const row = queryOne(db, 'SELECT id FROM kv_store WHERE type = ? AND id = ?', [type, id]);
            existed = !!row;
            if (existed) runSql(db, 'DELETE FROM kv_store WHERE type = ? AND id = ?', [type, id]);
        } else if (table === 'materials') {
            const row = queryOne(db, 'SELECT id FROM materials WHERE id = ?', [id]);
            existed = !!row;
            if (existed) runSql(db, 'DELETE FROM materials WHERE id = ?', [id]);
        } else if (table === 'chapters') {
            const row = queryOne(db, 'SELECT id FROM chapters WHERE id = ?', [id]);
            existed = !!row;
            if (existed) runSql(db, 'DELETE FROM chapters WHERE id = ?', [id]);
        } else if (table === 'projects') {
            const row = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id]);
            existed = !!row;
            if (existed) runSql(db, 'DELETE FROM projects WHERE id = ?', [id]);
        }
        if (existed) scheduleSave();
        return existed;
    } catch (err) {
        console.error(`[STORE] SQLite delete error for ${type}/${id}:`, err.message);
        return false;
    }
}

function queryItems(type, filter) {
    if (!filter) return listItems(type);

    if (type === 'materials' && filter.projectId) {
        const opts = { ...filter };
        delete opts.projectId;
        return queryMaterialsByProject(filter.projectId, opts);
    }
    if (type === 'chapters' && filter.projectId) {
        const opts = { ...filter };
        delete opts.projectId;
        return queryChaptersByProject(filter.projectId, opts);
    }

    if (typeof filter === 'function') return listItems(type).filter(filter);
    return listItems(type).filter(item => {
        return Object.keys(filter).every(key => {
            return item[key] === filter[key];
        });
    });
}

function isFoundationMaterial(mat) {
    if (!mat) return false;
    if (mat.isFoundation === true) return true;
    if (mat.isFoundation === false) return false;
    if (mat.sourceChapter) return false;
    if (CRAFT_TYPES.has(mat.type) && !mat.parentPlane) return true;
    if (['worldview', 'power-system'].includes(mat.type) && !mat.parentPlane) return true;
    if (mat.type === 'faction' && mat.parentPlane === null) return true;
    if (mat.type === 'institution' && mat.parentPlane === null) return true;
    if (mat.type === 'character' && mat.parentFaction) {
        const fac = getItem('materials', mat.parentFaction);
        if (fac && isFoundationMaterial(fac)) return true;
    }
    return false;
}

function queryMaterialsByProject(projectId, options = {}) {
    try {
        return queryMaterialsByProjectDB(projectId, options);
    } catch (_) {
        const items = listItems('materials');
        return items.filter(m => {
            if (m.projectId !== projectId) return false;
            if (options.type && m.type !== options.type) return false;
            if (options.archived === false && m.archived) return false;
            if (options.parentPlane && m.parentPlane !== options.parentPlane) return false;
            return true;
        });
    }
}

function queryChaptersByProject(projectId, options = {}) {
    try {
        return queryChaptersByProjectDB(projectId, options);
    } catch (_) {
        const items = listItems('chapters');
        return items
            .filter(c => {
                if (c.projectId !== projectId) return false;
                if (options.status && c.status !== options.status) return false;
                return true;
            })
            .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    }
}

function countItems(type, filter) {
    if (!filter || typeof filter === 'function') {
        return listItems(type).filter(typeof filter === 'function' ? filter : () => true).length;
    }
    try {
        return countItemsByType(type);
    } catch (_) {
        return listItems(type).length;
    }
}

module.exports = {
    listItems,
    getItem,
    setItem,
    deleteItem,
    queryItems,
    isFoundationMaterial,
    queryMaterialsByProject,
    queryChaptersByProject,
    countItems,
    trimItemData
};
