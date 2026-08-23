/**
 * v0006_materials-index-columns
 * 将roleLevel/lastAppearChapter/currentStatus从data JSON提升为PG独立列
 * 提升原因：这3个字段是高频查询/过滤字段，在data JSON中无法建索引
 *
 * 注意：此migration仅适用于PG后端。SQLite后端不需要（字段已在data JSON中）
 */
const logger = require('../../shared/logger');

function _getPool() {
    try {
        const { getPool } = require('../pgPool');
        return getPool();
    } catch (_) {
        return null;
    }
}

async function up(db) {
    const pool = _getPool();
    if (!pool) {
        logger.warn('migration', 'v0006 skipped: PG pool not available (SQLite backend)');
        return;
    }

    // 1. 新增3个列
    const columns = [
        { name: 'roleLevel', type: 'TEXT DEFAULT NULL' },
        { name: 'lastAppearChapter', type: 'INTEGER DEFAULT NULL' },
        { name: 'currentStatus', type: 'TEXT DEFAULT NULL' }
    ];

    for (const col of columns) {
        try {
            await pool.query(`ALTER TABLE materials ADD COLUMN ${col.name} ${col.type}`);
            logger.info('migration', `Added column materials.${col.name}`);
        } catch (e) {
            if (e.message.includes('already exists') || e.code === '42701') {
                logger.info('migration', `Column materials.${col.name} already exists, skipping`);
            } else {
                throw e;
            }
        }
    }

    // 2. 从现有data JSON中提取值回填新列
    const rows = (await pool.query('SELECT id, data FROM materials')).rows;
    let backfilled = 0;
    for (const row of rows) {
        try {
            const parsed = JSON.parse(row.data || '{}');
            const updates = [];
            const params = [];
            let paramIdx = 0;

            if (parsed.roleLevel != null) { paramIdx++; updates.push(`roleLevel = $${paramIdx}`); params.push(parsed.roleLevel); }
            if (parsed.lastAppearChapter != null) { paramIdx++; updates.push(`lastAppearChapter = $${paramIdx}`); params.push(parsed.lastAppearChapter); }
            if (parsed.currentStatus != null) { paramIdx++; updates.push(`currentStatus = $${paramIdx}`); params.push(parsed.currentStatus); }

            if (updates.length > 0) {
                paramIdx++;
                params.push(row.id);
                await pool.query(`UPDATE materials SET ${updates.join(', ')} WHERE id = $${paramIdx}`, params);
                backfilled++;
            }
        } catch (e) {
            logger.warn('migration', `Backfill failed for material ${row.id}: ${e.message}`);
        }
    }
    logger.info('migration', `Backfilled ${backfilled}/${rows.length} materials rows`);

    // 3. 创建索引
    try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_materials_roleLevel ON materials(roleLevel)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_materials_lastAppear ON materials(lastAppearChapter)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(currentStatus)`);
        logger.info('migration', 'Created indexes on new columns');
    } catch (e) {
        logger.warn('migration', `Index creation warning: ${e.message}`);
    }
}

async function down(db) {
    const pool = _getPool();
    if (!pool) return;

    try {
        await pool.query(`DROP INDEX IF EXISTS idx_materials_roleLevel`);
        await pool.query(`DROP INDEX IF EXISTS idx_materials_lastAppear`);
        await pool.query(`DROP INDEX IF EXISTS idx_materials_status`);
        logger.info('migration', 'Dropped indexes on new columns');
    } catch (e) {
        logger.warn('migration', `Index drop warning: ${e.message}`);
    }
}

module.exports = { up, down };
