/**
 * orphanCleanup — 孤儿数据扫描与清理
 *
 * 背景（2026-09-21 20章E2E 巡检发现）：
 *   多轮测试后库里堆积了大量"projectId 已不存在"的历史行：
 *   entities 207/237、entity_registry 154/184、reviews 182/412、state_kv_index 473/1329 …
 *   这些数据不会被任何页面展示，却会让健康统计虚高、按项目统计失真、备份体积膨胀。
 *
 * 安全设计：
 *   - 默认只扫描（dryRun），必须显式 clean=true 才删除；
 *   - 逐表统计 + 抽样展示，删除前可人工核对；
 *   - 支持 keepProjectIds 白名单（防止误删"还没建好的项目"的数据）；
 *   - 表结构差异（projectId 列存在与否、大小写）通过 information_schema 探测，不硬编码表名。
 */
const logger = require('../shared/logger');
const store = require('../store');

/** 与项目无直接 projectId 归属的系统级表，永不参与清理 */
const EXCLUDED_TABLES = new Set([
    'projects', 'api_keys', 'agent_bindings', 'kv_store', 'style_templates',
    'constraint_presets', 'agent_templates', 'style_profiles', 'schema_migrations'
]);

async function _pgPool() {
    const { getPool } = require('../db/pgPool');
    return getPool();
}

/** 列出所有带 projectId 列的业务表（去重、排除系统表） */
async function listProjectScopedTables() {
    const pool = await _pgPool();
    const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.columns
         WHERE table_schema = 'public' AND lower(column_name) = 'projectid'
         ORDER BY table_name`);
    return rows.map(r => r.table_name).filter(t => !EXCLUDED_TABLES.has(t));
}

/**
 * 扫描孤儿行
 * @param {{keepProjectIds?: string[]}} options
 * @returns {Promise<{tables: Array, total: number, samples: Object}>}
 */
async function scan(options = {}) {
    const pool = await _pgPool();
    const keep = new Set(options.keepProjectIds || []);
    const tables = await listProjectScopedTables();
    const liveProjects = (await pool.query('SELECT id FROM projects')).rows.map(r => r.id);
    liveProjects.forEach(id => keep.add(id));

    const result = [];
    let total = 0;
    const samples = {};
    for (const table of tables) {
        try {
            const { rows } = await pool.query(
                `SELECT projectid, COUNT(*) AS cnt FROM ${table}
                 WHERE projectid IS NOT NULL AND projectid <> '' AND NOT (projectid = ANY($1))
                 GROUP BY projectid ORDER BY cnt DESC LIMIT 50`, [Array.from(keep)]);
            const orphanCount = rows.reduce((s, r) => s + Number(r.cnt), 0);
            const allCount = Number((await pool.query(`SELECT COUNT(*) AS c FROM ${table}`)).rows[0].c);
            if (orphanCount > 0) {
                result.push({ table, orphans: orphanCount, total: allCount, byProject: rows.map(r => ({ projectId: r.projectid, count: Number(r.cnt) })) });
                samples[table] = rows.slice(0, 3).map(r => r.projectid);
                total += orphanCount;
            }
        } catch (e) {
            logger.warn('orphanCleanup', `扫描 ${table} 失败: ${e.message}`);
        }
    }
    return { tables: result, total, samples, scannedTables: tables.length, keepProjectIds: Array.from(keep) };
}

/**
 * 清理孤儿行
 * @param {{keepProjectIds?: string[]}} options
 * @returns {Promise<{deleted: Object, total: number}>}
 */
async function clean(options = {}) {
    const pool = await _pgPool();
    const keep = new Set(options.keepProjectIds || []);
    (await pool.query('SELECT id FROM projects')).rows.forEach(r => keep.add(r.id));
    const tables = await listProjectScopedTables();

    const deleted = {};
    let total = 0;
    for (const table of tables) {
        try {
            const res = await pool.query(
                `DELETE FROM ${table}
                 WHERE projectid IS NOT NULL AND projectid <> '' AND NOT (projectid = ANY($1))`,
                [Array.from(keep)]);
            if (res.rowCount > 0) { deleted[table] = res.rowCount; total += res.rowCount; }
        } catch (e) {
            logger.warn('orphanCleanup', `清理 ${table} 失败: ${e.message}`);
            deleted[table] = `ERROR: ${e.message}`;
        }
    }
    logger.info('orphanCleanup', `孤儿数据清理完成：共删除 ${total} 行（涉及 ${Object.keys(deleted).length} 张表）`, { total, tables: Object.keys(deleted) });
    return { deleted, total };
}

module.exports = { scan, clean, listProjectScopedTables, EXCLUDED_TABLES };
