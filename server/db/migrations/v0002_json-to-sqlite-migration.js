const fs = require('fs');
const path = require('path');
const { queryOne, runSql } = require('../database');
const logger = require('../../shared/logger');
const { extractReviewFields, extractQuestFields, extractTimelineFields, extractInfiniteStateFields, extractMaterialExtraFields, extractChapterExtraFields, extractProjectExtraFields } = require('./v0002FieldExtractors');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

function _readJsonFiles(dirName) {
    const dir = path.join(DATA_DIR, dirName);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            try {
                const content = fs.readFileSync(path.join(dir, f), 'utf-8').replace(/^\uFEFF/, '');
                if (!content.trim()) return null;
                return JSON.parse(content);
            } catch (e) {
                logger.warn('migration-v0002', `Skipping corrupt file: ${dirName}/${f}`);
                return null;
            }
        })
        .filter(Boolean);
}

function _migrateCollection(db, dirName, tableName, extractFn, insertFn, errors) {
    let migrated = 0, skipped = 0;
    const items = _readJsonFiles(dirName);
    for (const item of items) {
        try {
            if (!item.id) { skipped++; continue; }
            const existing = queryOne(db, `SELECT id FROM ${tableName} WHERE id = ?`, [item.id]);
            if (existing) { skipped++; continue; }
            insertFn(db, item, extractFn ? extractFn(item) : null);
            migrated++;
        } catch (e) {
            errors.push({ type: dirName, id: item.id, error: e.message });
        }
    }
    logger.info('migration-v0002', `${dirName}: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped };
}

async function up(db) {
    const errors = [];
    // Projects
    _migrateCollection(db, 'projects', 'projects', extractProjectExtraFields,
        (d, item, extra) => runSql(d, `INSERT INTO projects (id, data, mode, targetChapterCount, targetWordCount, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`,
            [item.id, JSON.stringify(item), extra.mode, extra.targetChapterCount, extra.targetWordCount,
             item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString()]), errors);
    // Materials
    _migrateCollection(db, 'materials', 'materials', extractMaterialExtraFields,
        (d, item, extra) => runSql(d, `INSERT INTO materials (id, projectId, type, name, parentPlane, parentFaction, archived,
            dialectRegion, dialectIntensity, speechStyle, speechStyleIntensity,
            namingStyle, namingStyleIntensity, archetype, currentPlaneId, isLocked, version, sourceChapter,
            data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [item.id, item.projectId || '', item.type || 'other', item.name || '', item.parentPlane ?? null, item.parentFaction ?? null, item.archived ? 1 : 0,
             extra.dialectRegion, extra.dialectIntensity, extra.speechStyle, extra.speechStyleIntensity,
             extra.namingStyle, extra.namingStyleIntensity, extra.archetype, extra.currentPlaneId, extra.isLocked, extra.version, extra.sourceChapter,
             JSON.stringify(item), item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString()]), errors);
    // Chapters
    _migrateCollection(db, 'chapters', 'chapters', extractChapterExtraFields,
        (d, item, extra) => runSql(d, `INSERT INTO chapters (id, projectId, chapterNumber, status, title, wordCount, round, data, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [item.id, item.projectId || '', item.chapterNumber || 0, item.status || 'outlined',
             extra.title, extra.wordCount, extra.round,
             JSON.stringify(item), item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString()]), errors);
    // Reviews, Quests, Timelines, Infinite Pipeline States (use INSERT OR IGNORE)
    for (const [dirName, tableName, extractFn, cols] of [
        ['reviews', 'reviews', extractReviewFields, 'id, chapterId, projectId, reviewType, passed, data, createdAt, updatedAt'],
        ['quests', 'quests', extractQuestFields, 'id, projectId, parentId, status, priority, data, createdAt, updatedAt'],
        ['timelines', 'timelines', extractTimelineFields, 'id, projectId, eventType, importance, isKeyEvent, data, createdAt, updatedAt'],
        ['infinite-pipeline-state', 'infinite_pipeline_state', extractInfiniteStateFields, 'id, projectId, running, phase, data, createdAt, updatedAt']
    ]) {
        let count = 0;
        for (const item of _readJsonFiles(dirName)) {
            try {
                if (!item.id) continue;
                const f = extractFn(item);
                const vals = Object.values(f);
                runSql(db, `INSERT OR IGNORE INTO ${tableName} (${cols}) VALUES (${cols.split(',').map(() => '?').join(',')})`,
                    [item.id, ...vals, JSON.stringify(item), item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString()]);
                count++;
            } catch (e) { errors.push({ type: dirName, id: item.id, error: e.message }); }
        }
        logger.info('migration-v0002', `${dirName}: ${count} migrated`);
    }
    // KV Store
    const kvTypes = ['chapter-audits', 'circuit-breakers', 'state-snapshots', 'version-snapshots'];
    let kvMigrated = 0;
    for (const type of kvTypes) {
        for (const item of _readJsonFiles(type)) {
            try {
                if (!item.id) continue;
                runSql(db, `INSERT OR IGNORE INTO kv_store (type, id, data, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
                    [type, item.id, JSON.stringify(item), item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString()]);
                kvMigrated++;
            } catch (e) { errors.push({ type, id: item.id, error: e.message }); }
        }
    }
    logger.info('migration-v0002', `KV Store: ${kvMigrated} migrated across ${kvTypes.length} types`);
    if (errors.length > 0) {
        logger.warn('migration-v0002', `${errors.length} errors during migration`);
        errors.forEach(e => logger.warn('migration-v0002', `  - ${e.type}/${e.id}: ${e.error}`));
    }
    logger.info('migration-v0002', 'JSON→SQLite migration complete');
}

async function down(db) {
    const tables = ['reviews', 'pipeline_logs', 'infinite_pipeline_state', 'quests', 'timelines'];
    for (const table of tables) {
        try { runSql(db, `DELETE FROM ${table}`); logger.info('migration-v0002', `Rollback: cleared ${table}`); }
        catch (e) { logger.warn('migration-v0002', `Rollback: could not clear ${table}: ${e.message}`); }  // DEGRADE: 影响=runSql 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }
    try { runSql(db, `DELETE FROM kv_store WHERE type IN ('chapter-audits', 'circuit-breakers', 'state-snapshots', 'version-snapshots')`); }
    catch (e) { logger.warn('migration-v0002', `Rollback: could not clear kv_store: ${e.message}`); }  // DEGRADE: 影响=runSql 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    try { runSql(db, `UPDATE materials SET dialectRegion=NULL, dialectIntensity='medium', speechStyle=NULL, speechStyleIntensity='medium', namingStyle=NULL, namingStyleIntensity='medium', archetype=NULL, currentPlaneId=NULL, isLocked=0, version=1, sourceChapter=NULL`); }
    catch (e) { logger.warn('migration-v0002', `Rollback: could not reset materials: ${e.message}`); }  // DEGRADE: 影响=runSql 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    try { runSql(db, `UPDATE chapters SET title='', wordCount=0, round=0`); }
    catch (e) { logger.warn('migration-v0002', `Rollback: could not reset chapters: ${e.message}`); }  // DEGRADE: 影响=runSql 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    try { runSql(db, `UPDATE projects SET mode='novel', targetChapterCount=NULL, targetWordCount=NULL`); }
    catch (e) { logger.warn('migration-v0002', `Rollback: could not reset projects: ${e.message}`); }  // DEGRADE: 影响=runSql 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    logger.info('migration-v0002', 'Data migration rolled back');
}

module.exports = { up, down, version: 2, name: 'json-to-sqlite-migration' };
