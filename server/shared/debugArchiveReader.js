'use strict';

/**
 * 调试日志归档查询器
 *
 * 职责：从 PG 检索已归档的日志数据（冷数据查询）
 *
 * 从 debugPersister.js 拆分以满足单文件 200 行限制
 *
 * 文件位置：server/shared/debugArchiveReader.js
 */

/**
 * 按 traceId 检索归档日志
 * @param {import('pg').Pool} pool
 * @param {string} traceId
 * @param {Object} [opts] - { level }
 */
async function getArchivedByTraceId(pool, traceId, opts = {}) {
    if (!pool) return null;
    const level = opts.level;
    const params = [traceId];
    let levelClause = '';
    if (level) {
        params.push(level);
        levelClause = ` AND level = $2`;
    }
    const result = await pool.query(`
        SELECT trace_id, timestamp, level, module, message, context
        FROM debug_logs
        WHERE trace_id = $1${levelClause}
        ORDER BY timestamp ASC
    `, params);

    if (result.rows.length === 0) return null;

    const logs = result.rows.map(r => ({
        timestamp: r.timestamp.toISOString(),
        level: r.level,
        module: r.module,
        message: r.message,
        context: r.context || {}
    }));

    const levelCounts = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const l of logs) {
        if (levelCounts[l.level] !== undefined) levelCounts[l.level]++;
    }

    return {
        traceId,
        createdAt: new Date(logs[0].timestamp).getTime(),
        updatedAt: new Date(logs[logs.length - 1].timestamp).getTime(),
        logCount: logs.length,
        levelCounts,
        logs,
        archived: true
    };
}

/**
 * 列出归档的 traceId（按时间倒序）
 * @param {import('pg').Pool} pool
 * @param {Object} [opts] - { limit, level }
 */
async function listArchivedTraces(pool, opts = {}) {
    if (!pool) return [];
    const limit = Math.min(opts.limit || 50, 200);
    const level = opts.level;
    const params = [limit];
    let levelClause = '';
    if (level) {
        params.push(level);
        levelClause = ` AND (level_counts->>$2)::int > 0`;
    }
    const result = await pool.query(`
        SELECT trace_id, created_at, updated_at, log_count, level_counts, has_error
        FROM debug_traces
        WHERE 1=1${levelClause}
        ORDER BY updated_at DESC
        LIMIT $1
    `, params);

    return result.rows.map(r => ({
        traceId: r.trace_id,
        createdAt: r.created_at.getTime(),
        updatedAt: r.updated_at.getTime(),
        logCount: r.log_count,
        levelCounts: r.level_counts || { debug: 0, info: 0, warn: 0, error: 0 },
        hasError: r.has_error,
        archived: true
    }));
}

module.exports = {
    getArchivedByTraceId,
    listArchivedTraces
};
