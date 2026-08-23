const { getDatabase, getTableForType, safeParse, extractMaterialFields, extractChapterFields, extractProjectFields, extractKvFields, runSql, queryOne } = require('./database');

function extractCharStateFields(data) {
    return {
        id: data.id,
        projectId: data.projectId || '',
        characterId: data.characterId || '',
        characterName: data.characterName || '',
        chapterNumber: data.chapterNumber || 0,
        delta: JSON.stringify(data.delta || {}),
        stateChangedFields: JSON.stringify(data.stateChangedFields || []),
        previousChapterState: data.previousChapterState ?? null,
        data: JSON.stringify(data)
    };
}

function extractStateKvFields(data) {
    return {
        id: data.id,
        projectId: data.projectId || '',
        scope: data.scope || '',
        entityKey: data.entityKey || '',
        dataKey: data.dataKey || '',
        dataValue: data.dataValue || '',
        dataType: data.dataType || 'string',
        chapterUpdated: data.chapterUpdated || 0,
        isHot: data.isHot ? 1 : 0,
        data: JSON.stringify(data)
    };
}

function writeItemToDb(type, id, data) {
    const db = getDatabase();
    const table = getTableForType(type);

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
    } else if (table === 'character_states') {
        const f = extractCharStateFields(data);
        const existing = queryOne(db, 'SELECT id FROM character_states WHERE id = ?', [id]);
        if (existing) {
            runSql(db, `UPDATE character_states SET projectId=?, characterId=?, characterName=?, chapterNumber=?, delta=?, stateChangedFields=?, previousChapterState=?, data=?, updatedAt=? WHERE id=?`,
                [f.projectId, f.characterId, f.characterName, f.chapterNumber, f.delta, f.stateChangedFields, f.previousChapterState, f.data, data.updatedAt, id]);
        } else {
            runSql(db, `INSERT INTO character_states (id, projectId, characterId, characterName, chapterNumber, delta, stateChangedFields, previousChapterState, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [f.id, f.projectId, f.characterId, f.characterName, f.chapterNumber, f.delta, f.stateChangedFields, f.previousChapterState, f.data, data.createdAt, data.updatedAt]);
        }
    } else if (table === 'state_kv_index') {
        const f = extractStateKvFields(data);
        const existing = queryOne(db, 'SELECT id FROM state_kv_index WHERE id = ?', [id]);
        if (existing) {
            runSql(db, `UPDATE state_kv_index SET projectId=?, scope=?, entityKey=?, dataKey=?, dataValue=?, dataType=?, chapterUpdated=?, isHot=?, data=?, updatedAt=? WHERE id=?`,
                [f.projectId, f.scope, f.entityKey, f.dataKey, f.dataValue, f.dataType, f.chapterUpdated, f.isHot, f.data, data.updatedAt, id]);
        } else {
            runSql(db, `INSERT INTO state_kv_index (id, projectId, scope, entityKey, dataKey, dataValue, dataType, chapterUpdated, isHot, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [f.id, f.projectId, f.scope, f.entityKey, f.dataKey, f.dataValue, f.dataType, f.chapterUpdated, f.isHot, f.data, data.createdAt, data.updatedAt]);
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
}

module.exports = {
    extractCharStateFields,
    extractStateKvFields,
    writeItemToDb
};
