const { getDatabase, runSql, safeParse, queryAll, queryOne } = require('../database');
const logger = require('../../shared/logger');
const { extractCharacterUpdates, buildCharacterStateRecord, inferType, detectGenre } = require('./v0005Helpers');

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS character_states (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    characterId TEXT NOT NULL,
    characterName TEXT NOT NULL DEFAULT '',
    chapterNumber INTEGER NOT NULL,
    delta TEXT DEFAULT '{}',
    stateChangedFields TEXT DEFAULT '[]',
    previousChapterState TEXT,
    updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_char_state_project ON character_states(projectId, characterId);
CREATE INDEX IF NOT EXISTS idx_char_state_chapter ON character_states(projectId, chapterNumber);
CREATE TABLE IF NOT EXISTS state_kv_index (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    scope TEXT NOT NULL,
    entityKey TEXT NOT NULL,
    dataKey TEXT NOT NULL,
    dataValue TEXT NOT NULL,
    dataType TEXT DEFAULT 'string',
    chapterUpdated INTEGER NOT NULL,
    isHot INTEGER DEFAULT 0,
    updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kv_project_scope ON state_kv_index(projectId, scope);
CREATE INDEX IF NOT EXISTS idx_kv_entity ON state_kv_index(projectId, entityKey);
CREATE INDEX IF NOT EXISTS idx_kv_hot ON state_kv_index(projectId, scope, isHot);
`;

async function up(db) {
    const dbInstance = db || getDatabase();
    dbInstance.exec(SCHEMA_SQL);
    logger.info('migration-v0005', 'Character state tables created');
}

async function down(db) {
    const d = db || getDatabase();
    for (const idx of ['idx_char_state_project', 'idx_char_state_chapter', 'idx_kv_project_scope', 'idx_kv_entity', 'idx_kv_hot']) {
        try { d.run(`DROP INDEX IF EXISTS ${idx}`); } catch { /* index may not exist */ }
    }
    for (const tbl of ['character_states', 'state_kv_index']) {
        try { d.run(`DROP TABLE IF EXISTS ${tbl}`); } catch { /* table may not exist */ }
    }
    logger.info('migration-v0005', 'Character state tables dropped');
}

async function migrateCharacterStates(db) {
    const dbInstance = db || getDatabase();
    logger.info('migration-v0005', 'Starting character state data migration...');
    const projects = queryAll(dbInstance, 'SELECT data FROM projects');
    let totalProjects = 0, totalChapters = 0, totalStates = 0;
    for (const projRow of projects) {
        const project = safeParse(projRow.data);
        if (!project?.id) continue;
        totalProjects++;
        const projectId = project.id;
        const maxChapter = Math.max(0, ...(project.chapters || []).map(c => c.number || 0));
        try {
            const chapters = queryAll(dbInstance, 'SELECT data FROM chapters WHERE projectId = ?', [projectId])
                .map(c => safeParse(c.data)).filter(Boolean)
                .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
            for (const chapter of chapters) {
                if (!chapter.materialManagerOutput) continue;
                totalChapters++;
                const characterUpdates = extractCharacterUpdates(chapter.materialManagerOutput);
                const byCharacter = {};
                for (const u of characterUpdates) {
                    if (!u.name) continue;
                    const key = u.characterId || u.name;
                    if (!byCharacter[key]) byCharacter[key] = { name: u.name, characterId: key, updates: [] };
                    byCharacter[key].updates.push(u);
                }
                for (const [key, charData] of Object.entries(byCharacter)) {
                    if (charData.updates.length === 0) continue;
                    for (const update of charData.updates) {
                        const kvId = `kv-${projectId}-character-${key}-${update.dataKey}`;
                        if (queryOne(dbInstance, 'SELECT id FROM state_kv_index WHERE id = ?', [kvId])) continue;
                        const dataValue = typeof update.stateValue === 'string' ? update.stateValue : JSON.stringify(update.stateValue);
                        const now = new Date().toISOString();
                        runSql(dbInstance, `INSERT OR IGNORE INTO state_kv_index (id, projectId, scope, entityKey, dataKey, dataValue, dataType, chapterUpdated, isHot, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                            [kvId, projectId, 'character', key, update.dataKey, dataValue, inferType(update.stateValue), chapter.chapterNumber, 0, now]);
                        totalStates++;
                    }
                    const rec = buildCharacterStateRecord(charData.characterId, charData.name, chapter.chapterNumber, charData.updates, projectId);
                    if (rec && !queryOne(dbInstance, 'SELECT id FROM character_states WHERE id = ?', [rec.id])) {
                        runSql(dbInstance, `INSERT OR IGNORE INTO character_states (id, projectId, characterId, characterName, chapterNumber, delta, stateChangedFields, previousChapterState, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)`,
                            [rec.id, rec.projectId, rec.characterId, rec.characterName, rec.chapterNumber, rec.delta, rec.stateChangedFields, rec.previousChapterState, rec.updatedAt]);
                    }
                }
            }
            if (maxChapter > 0) {
                const metaId = `meta-${projectId}-currentChapter`;
                if (!queryOne(dbInstance, 'SELECT id FROM kv_store WHERE type = ? AND id = ?', ['state-meta', metaId])) {
                    const now = new Date().toISOString();
                    runSql(dbInstance, `INSERT OR IGNORE INTO kv_store (type, id, data, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
                        ['state-meta', metaId, JSON.stringify({ id: metaId, projectId, currentChapter: maxChapter, createdAt: now, updatedAt: now }), now, now]);
                }
            }
        } catch (e) {
            logger.error('migration-v0005', `Failed to migrate project ${projectId}: ${e.message}`);
        }
    }
    logger.info('migration-v0005', `Migration complete: ${totalProjects} projects, ${totalChapters} chapters, ${totalStates} states`);
    return { projects: totalProjects, chapters: totalChapters, states: totalStates };
}

module.exports = { up, down, migrateCharacterStates, version: 5, name: 'character-state-system' };
