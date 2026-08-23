const { runSql, queryAll, queryOne } = require('../database');
const logger = require('../../shared/logger');

const UP_SQL = `
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    chapterId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    reviewType TEXT NOT NULL DEFAULT 'first-review',
    passed INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_chapter ON reviews(chapterId);
CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(projectId);
CREATE INDEX IF NOT EXISTS idx_reviews_type ON reviews(reviewType);

CREATE TABLE IF NOT EXISTS pipeline_logs (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    chapterId TEXT,
    step TEXT,
    status TEXT DEFAULT 'running',
    round INTEGER DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_project ON pipeline_logs(projectId);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_chapter ON pipeline_logs(chapterId);

CREATE TABLE IF NOT EXISTS infinite_pipeline_state (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL UNIQUE,
    running INTEGER NOT NULL DEFAULT 0,
    phase TEXT,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_infinite_pipeline_project ON infinite_pipeline_state(projectId);

CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    parentId TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    priority TEXT NOT NULL DEFAULT 'normal',
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quests_project ON quests(projectId);
CREATE INDEX IF NOT EXISTS idx_quests_parent ON quests(parentId);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);

CREATE TABLE IF NOT EXISTS timelines (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    eventType TEXT NOT NULL DEFAULT 'plot',
    importance TEXT NOT NULL DEFAULT 'normal',
    isKeyEvent INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_timelines_project ON timelines(projectId);
CREATE INDEX IF NOT EXISTS idx_timelines_type ON timelines(eventType);

ALTER TABLE materials ADD COLUMN dialectRegion TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN dialectIntensity TEXT DEFAULT 'medium';
ALTER TABLE materials ADD COLUMN speechStyle TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN speechStyleIntensity TEXT DEFAULT 'medium';
ALTER TABLE materials ADD COLUMN namingStyle TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN namingStyleIntensity TEXT DEFAULT 'medium';
ALTER TABLE materials ADD COLUMN archetype TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN currentPlaneId TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN isLocked INTEGER DEFAULT 0;
ALTER TABLE materials ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE materials ADD COLUMN sourceChapter INTEGER DEFAULT NULL;

ALTER TABLE chapters ADD COLUMN title TEXT DEFAULT '';
ALTER TABLE chapters ADD COLUMN wordCount INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN round INTEGER DEFAULT 0;

ALTER TABLE projects ADD COLUMN mode TEXT DEFAULT 'novel';
ALTER TABLE projects ADD COLUMN targetChapterCount INTEGER DEFAULT NULL;
ALTER TABLE projects ADD COLUMN targetWordCount INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_materials_dialect ON materials(dialectRegion);
CREATE INDEX IF NOT EXISTS idx_materials_style ON materials(speechStyle);
CREATE INDEX IF NOT EXISTS idx_materials_locked ON materials(isLocked);
CREATE INDEX IF NOT EXISTS idx_materials_version ON materials(version);
CREATE INDEX IF NOT EXISTS idx_chapters_wordcount ON chapters(wordCount);
CREATE INDEX IF NOT EXISTS idx_projects_mode ON projects(mode);
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS pipeline_logs;
DROP TABLE IF EXISTS infinite_pipeline_state;
DROP TABLE IF EXISTS quests;
DROP TABLE IF EXISTS timelines;

CREATE TABLE materials_new AS SELECT
    id, projectId, type, name, parentPlane, parentFaction, archived, data, createdAt, updatedAt
FROM materials;
DROP TABLE materials;
ALTER TABLE materials_new RENAME TO materials;

CREATE INDEX idx_materials_project ON materials(projectId);
CREATE INDEX idx_materials_type ON materials(type, archived);
CREATE INDEX idx_materials_parent ON materials(parentPlane, parentFaction);

CREATE TABLE chapters_new AS SELECT
    id, projectId, chapterNumber, status, data, createdAt, updatedAt
FROM chapters;
DROP TABLE chapters;
ALTER TABLE chapters_new RENAME TO chapters;

CREATE INDEX idx_chapters_project ON chapters(projectId, chapterNumber);
CREATE INDEX idx_chapters_status ON chapters(status);

CREATE TABLE projects_new AS SELECT
    id, data, createdAt, updatedAt
FROM projects;
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;
`;

async function up(db) {
    const statements = UP_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const sql of statements) {
        try {
            runSql(db, sql);
        } catch (e) {
            if (e.message.includes('duplicate column name') || e.message.includes('already exists')) {
                logger.warn('migration-v0001', `Skipping (already exists): ${sql.substring(0, 80)}...`);
            } else {
                throw e;
            }
        }
    }
    logger.info('migration-v0001', 'Schema expansion applied');
}

async function down(db) {
    const statements = DOWN_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    for (const sql of statements) {
        try {
            runSql(db, sql);
        } catch (e) {
            logger.warn('migration-v0001', `Rollback warning: ${e.message}`);
        }
    }
    logger.info('migration-v0001', 'Schema expansion rolled back');
}

module.exports = { up, down, version: 1, name: 'schema-expansion' };
