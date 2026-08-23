'use strict';

/**
 * 调试日志 PG 写入组件（G7 拆分）
 *
 * 职责：封装所有 PG 写入/清理操作，从 debugPersister.js 抽离以符合 200 行限制
 * - writeBatch：批量写入日志条目 + upsert trace 元数据
 * - persistAlert / deleteAlert：告警持久化
 * - cleanup：过期数据清理
 *
 * 文件位置：server/shared/debugPgWriter.js
 */

// R6: 使用统一 logger 替代 console.*，确保日志进入追踪链路
const logger = require('./logger');

const ALERT_RETENTION_HOURS = 24;

class DebugPgWriter {
    /**
     * @param {import('pg').Pool} pool
     */
    constructor(pool) {
        this._pool = pool;
    }

    /**
     * 批量写入日志条目 + upsert trace 元数据
     * @param {Array} batch - debugPersister 格式化的日志条目数组
     */
    async writeBatch(batch) {
        const client = await this._pool.connect();
        try {
            await client.query('BEGIN');
            await this._upsertTraces(client, batch);
            await this._insertLogs(client, batch);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * upsert debug_traces 元数据
     */
    async _upsertTraces(client, batch) {
        const traceIds = [...new Set(batch.map(b => b.traceId))];
        for (const traceId of traceIds) {
            const traceLogs = batch.filter(b => b.traceId === traceId);
            const levelCounts = { debug: 0, info: 0, warn: 0, error: 0 };
            let firstTs = null, lastTs = null;
            for (const l of traceLogs) {
                levelCounts[l.level] = (levelCounts[l.level] || 0) + 1;
                const ts = new Date(l.timestamp).getTime();
                if (firstTs === null || ts < firstTs) firstTs = ts;
                if (lastTs === null || ts > lastTs) lastTs = ts;
            }
            const hasError = levelCounts.error > 0;
            await client.query(`
                INSERT INTO debug_traces (trace_id, created_at, updated_at, log_count, level_counts, has_error)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (trace_id) DO UPDATE SET
                    updated_at = EXCLUDED.updated_at,
                    log_count = debug_traces.log_count + EXCLUDED.log_count,
                    level_counts = debug_traces.level_counts || EXCLUDED.level_counts,
                    has_error = debug_traces.has_error OR EXCLUDED.has_error
            `, [
                traceId,
                new Date(firstTs),
                new Date(lastTs),
                traceLogs.length,
                JSON.stringify(levelCounts),
                hasError
            ]);
        }
    }

    /**
     * 批量 INSERT debug_logs
     */
    async _insertLogs(client, batch) {
        const values = [];
        const params = [];
        for (let i = 0; i < batch.length; i++) {
            const l = batch[i];
            const base = i * 7;
            values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
            params.push(l.id, l.traceId, l.timestamp, l.level, l.module, l.message, JSON.stringify(l.context));
        }
        await client.query(`
            INSERT INTO debug_logs (id, trace_id, timestamp, level, module, message, context)
            VALUES ${values.join(', ')}
            ON CONFLICT (id) DO NOTHING
        `, params);
    }

    /**
     * 持久化告警（触发或更新时调用）
     */
    async persistAlert(alert) {
        try {
            await this._pool.query(`
                INSERT INTO debug_alerts (id, rule_id, rule_name, severity, key, count, threshold, triggered_at, acknowledged, sample_trace_id, sample_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO UPDATE SET
                    count = EXCLUDED.count,
                    acknowledged = EXCLUDED.acknowledged,
                    acknowledged_at = CASE WHEN EXCLUDED.acknowledged AND debug_alerts.acknowledged_at IS NULL THEN NOW() ELSE debug_alerts.acknowledged_at END
            `, [
                alert.id, alert.ruleId, alert.ruleName, alert.severity, alert.key,
                alert.count, alert.threshold, new Date(alert.triggeredAt),
                alert.acknowledged, alert.sampleTraceId, alert.sampleMessage
            ]);
        } catch (e) {
            logger.error('debugPgWriter', `[debugPgWriter] persistAlert failed: ${e.message}`);
        }
    }

    /**
     * 删除已恢复的告警
     */
    async deleteAlert(alertId) {
        try {
            await this._pool.query(`DELETE FROM debug_alerts WHERE id = $1`, [alertId]);
        } catch (e) {
            logger.error('debugPgWriter', `[debugPgWriter] deleteAlert failed: ${e.message}`);
        }
    }

    /**
     * 清理过期数据
     * @param {number} retentionDays - 日志/trace 保留天数
     */
    async cleanup(retentionDays) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        try {
            const logsResult = await this._pool.query(`DELETE FROM debug_logs WHERE timestamp < $1`, [cutoff]);
            const tracesResult = await this._pool.query(`DELETE FROM debug_traces WHERE updated_at < $1 AND NOT EXISTS (SELECT 1 FROM debug_logs WHERE debug_logs.trace_id = debug_traces.trace_id)`, [cutoff]);
            const alertsCutoff = new Date(Date.now() - ALERT_RETENTION_HOURS * 60 * 60 * 1000);
            const alertsResult = await this._pool.query(`DELETE FROM debug_alerts WHERE triggered_at < $1`, [alertsCutoff]);
            logger.info('debugPgWriter', `[debugPgWriter] cleanup: ${logsResult.rowCount} logs, ${tracesResult.rowCount} traces, ${alertsResult.rowCount} alerts removed (cutoff=${cutoff.toISOString()})`);
        } catch (e) {
            logger.error('debugPgWriter', `[debugPgWriter] cleanup failed: ${e.message}`);
        }
    }
}

module.exports = { DebugPgWriter, ALERT_RETENTION_HOURS };
