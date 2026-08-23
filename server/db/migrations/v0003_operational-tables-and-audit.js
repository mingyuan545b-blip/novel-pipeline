const { runSql } = require('../database');
const logger = require('../../shared/logger');

const UP_SQL = `
CREATE TABLE IF NOT EXISTS change_history (
    id TEXT PRIMARY KEY,
    itemType TEXT NOT NULL,
    itemId TEXT NOT NULL,
    action TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    performedBy TEXT DEFAULT 'system',
    createdAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_change_history_item ON change_history(itemType, itemId);
CREATE INDEX IF NOT EXISTS idx_change_history_action ON change_history(action);
CREATE INDEX IF NOT EXISTS idx_change_history_created ON change_history(createdAt);

CREATE TABLE IF NOT EXISTS migration_lock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked INTEGER NOT NULL DEFAULT 0,
    lockedBy TEXT,
    lockedAt TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keyHash TEXT NOT NULL UNIQUE,
    permissions TEXT NOT NULL DEFAULT '["read"]',
    isActive INTEGER NOT NULL DEFAULT 1,
    lastUsed TEXT,
    lastRotated TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(keyHash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(isActive);

CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    resourceType TEXT NOT NULL,
    resourceId TEXT,
    details TEXT,
    performedBy TEXT DEFAULT 'system',
    ipAddress TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resourceType, resourceId);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(createdAt);

ALTER TABLE materials ADD COLUMN changeReason TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN archivedReason TEXT DEFAULT NULL;
ALTER TABLE materials ADD COLUMN archivedAt TEXT DEFAULT NULL;

ALTER TABLE chapters ADD COLUMN _reviewRounds INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN _wordCountRetry INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN _skipReason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_materials_archived_reason ON materials(archivedReason);
CREATE INDEX IF NOT EXISTS idx_chapters_skip ON chapters(_skipReason);
`;

const DOWN_SQL = `
DROP TABLE IF EXISTS change_history;
DROP TABLE IF EXISTS migration_lock;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS audit_log;

CREATE TABLE materials_new AS SELECT
    id, projectId, type, name, parentPlane, parentFaction, archived,
    dialectRegion, dialectIntensity, speechStyle, speechStyleIntensity,
    namingStyle, namingStyleIntensity, archetype, currentPlaneId, isLocked, version, sourceChapter,
    data, createdAt, updatedAt
FROM materials;
DROP TABLE materials;
ALTER TABLE materials_new RENAME TO materials;

CREATE INDEX idx_materials_project ON materials(projectId);
CREATE INDEX idx_materials_type ON materials(type, archived);
CREATE INDEX idx_materials_parent ON materials(parentPlane, parentFaction);
CREATE INDEX idx_materials_dialect ON materials(dialectRegion);
CREATE INDEX idx_materials_style ON materials(speechStyle);
CREATE INDEX idx_materials_locked ON materials(isLocked);
CREATE INDEX idx_materials_version ON materials(version);

CREATE TABLE chapters_new AS SELECT
    id, projectId, chapterNumber, status, title, wordCount, round, data, createdAt, updatedAt
FROM chapters;
DROP TABLE chapters;
ALTER TABLE chapters_new RENAME TO chapters;

CREATE INDEX idx_chapters_project ON chapters(projectId, chapterNumber);
CREATE INDEX idx_chapters_status ON chapters(status);
CREATE INDEX idx_chapters_wordcount ON chapters(wordCount);
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
                logger.warn('migration-v0003', `Skipping (already exists): ${sql.substring(0, 80)}...`);
            } else {
                throw e;
            }
        }
    }
    logger.info('migration-v0003', 'Operational tables and audit fields applied');
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
            logger.warn('migration-v0003', `Rollback warning: ${e.message}`);
        }
    }
    logger.info('migration-v0003', 'Operational tables rolled back');
}

module.exports = { up, down, version: 3, name: 'operational-tables-and-audit' };
