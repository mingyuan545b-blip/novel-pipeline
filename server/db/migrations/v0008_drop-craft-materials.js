/**
 * v0008_drop-craft-materials
 *
 * 删除 craft_materials 表（F8 裁决=删表，见 docs/worklog/2026-10-17-假成果审查-问题统计.md §六.3）。
 * 背景：该表声明齐备（DDL/字段注册/writer handler/dataStoreRegistry 全有），但全仓无任何运行时
 * 写入/读取通道，实测 0 行 —— 典型"结构齐备、通道零产出"的假成果。用户裁决为删表并清理相关代码。
 *
 * 本 migration 负责在 PG 上落地 DROP；代码侧声明已同步移除（knowledgeSchemaFacts / pgConstants /
 * store-pg-writer-registry / dataStoreRegistry / fieldRegistryRelation / verifyRegistryConsistency）。
 *
 * 注意：仅适用于 PG 后端；SQLite 后端跳过。
 * 文件位置：server/db/migrations/v0008_drop-craft-materials.js
 */
'use strict';

const logger = require('../../shared/logger');

function _getPool() {
    try {
        const { getPool } = require('../pgPool');
        return getPool();
    } catch (_) {
        return null;
    }
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS craft_materials (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    craftType TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    archived TEXT DEFAULT '',
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW()
)`;

async function up() {
    const pool = _getPool();
    if (!pool) {
        logger.warn('migration', 'v0008 skipped: PG pool not available (SQLite backend)');
        return;
    }
    try {
        await pool.query('DROP TABLE IF EXISTS craft_materials');
        logger.info('migration', 'Dropped table craft_materials (F8)');
    } catch (e) {
        logger.error('migration', `Drop craft_materials failed: ${e.message}`);
        throw e;
    }
}

async function down() {
    const pool = _getPool();
    if (!pool) return;
    try {
        await pool.query(CREATE_SQL);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_craft_project ON craft_materials(projectId)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_craft_project_type ON craft_materials(projectId, craftType)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_craft_project_name ON craft_materials(projectId, name)');
        logger.info('migration', 'Recreated table craft_materials (rollback)');
    } catch (e) {
        logger.warn('migration', `Recreate craft_materials warning: ${e.message}`);
    }
}

module.exports = { up, down };
