const logger = require('../shared/logger');
const { getPool } = require('./pgPool');

let _safeParseFailCount = 0;
const SAFE_PARSE_WARN_THRESHOLD = 5;
const MAX_SAFE_PARSE_FAIL_COUNT = 100;

function safeParse(jsonStr, context = '') {
    if (!jsonStr) return null;
    if (typeof jsonStr === 'object') return jsonStr;
    try {
        return JSON.parse(jsonStr);
    } catch (_) {
        _safeParseFailCount++;
        if (_safeParseFailCount > MAX_SAFE_PARSE_FAIL_COUNT) {
            logger.warn('database-pg', `safeParse失败计数器达到上限(${MAX_SAFE_PARSE_FAIL_COUNT})，已自动重置`);
            _safeParseFailCount = 0;
        }
        const preview = jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
        logger.warn('database-pg', `safeParse failed (${_safeParseFailCount} total)${context ? ' [' + context + ']' : ''}: ${_.message}. Preview: ${preview.substring(0, 80)}`);
        if (_safeParseFailCount >= SAFE_PARSE_WARN_THRESHOLD && _safeParseFailCount % SAFE_PARSE_WARN_THRESHOLD === 0) {
            logger.error('database-pg', `safeParse累计失败${_safeParseFailCount}次，可能存在数据损坏。`);
        }
        return null;
    }
}

function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

async function queryAll(poolOrClient, sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await poolOrClient.query(pgSql, params);
    return result.rows;
}

async function queryOne(poolOrClient, sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await poolOrClient.query(pgSql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
}

async function runSql(poolOrClient, sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    await poolOrClient.query(pgSql, params);
}

async function withTransaction(fn) {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (rbErr) { /* rollback failed */ }
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { safeParse, convertPlaceholders, queryAll, queryOne, runSql, withTransaction };
