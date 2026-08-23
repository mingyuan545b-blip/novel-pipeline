/**
 * v0007_debug-logging-tables
 * 错误可追踪性体系持久化层
 *
 * 新增表：
 * - debug_logs: 日志条目（按 traceId 关联）
 * - debug_traces: trace 元数据（首末时间、级别计数）
 * - debug_alerts: 告警状态（含确认标记）
 *
 * 设计说明：
 * - 采用 PG 原生 TIMESTAMPTZ，避免时区问题
 * - context 字段使用 JSONB，支持灵活查询
 * - 索引覆盖：trace_id（检索）、timestamp（时间范围）、level（过滤）
 * - 保留策略由 debugPersister 定时清理（默认 7 天）
 *
 * 文件位置：server/db/migrations/v0007_debug-logging-tables.js
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

async function up() {
    const pool = _getPool();
    if (!pool) {
        logger.warn('migration', 'v0007 skipped: PG pool not available');
        return;
    }

    // 1. debug_traces — trace 元数据表
    await pool.query(`
        CREATE TABLE IF NOT EXISTS debug_traces (
            trace_id TEXT PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            log_count INTEGER NOT NULL DEFAULT 0,
            level_counts JSONB NOT NULL DEFAULT '{"debug":0,"info":0,"warn":0,"error":0}',
            has_error BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_traces_created ON debug_traces(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_traces_updated ON debug_traces(updated_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_traces_has_error ON debug_traces(has_error) WHERE has_error = TRUE`);

    // 2. debug_logs — 日志条目表
    await pool.query(`
        CREATE TABLE IF NOT EXISTS debug_logs (
            id TEXT PRIMARY KEY,
            trace_id TEXT NOT NULL,
            timestamp TIMESTAMPTZ NOT NULL,
            level TEXT NOT NULL,
            module TEXT NOT NULL,
            message TEXT NOT NULL,
            context JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY (trace_id) REFERENCES debug_traces(trace_id) ON DELETE CASCADE
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_logs_trace ON debug_logs(trace_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_logs_ts ON debug_logs(timestamp DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_logs_module ON debug_logs(module)`);

    // 3. debug_alerts — 告警状态表
    await pool.query(`
        CREATE TABLE IF NOT EXISTS debug_alerts (
            id TEXT PRIMARY KEY,
            rule_id TEXT NOT NULL,
            rule_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            key TEXT NOT NULL,
            count INTEGER NOT NULL,
            threshold INTEGER NOT NULL,
            triggered_at TIMESTAMPTZ NOT NULL,
            acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
            acknowledged_at TIMESTAMPTZ,
            sample_trace_id TEXT,
            sample_message TEXT
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_alerts_triggered ON debug_alerts(triggered_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_alerts_severity ON debug_alerts(severity)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_debug_alerts_ack ON debug_alerts(acknowledged) WHERE acknowledged = FALSE`);

    logger.info('migration', 'v0007 applied: debug_traces, debug_logs, debug_alerts tables created');
}

async function down() {
    const pool = _getPool();
    if (!pool) return;

    await pool.query(`DROP TABLE IF EXISTS debug_alerts`);
    await pool.query(`DROP TABLE IF EXISTS debug_logs`);
    await pool.query(`DROP TABLE IF EXISTS debug_traces`);
    logger.info('migration', 'v0007 rolled back: debug tables dropped');
}

module.exports = { up, down };
