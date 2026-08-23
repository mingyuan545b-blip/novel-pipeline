'use strict';

/**
 * 调试日志持久化调度器类
 *
 * 职责：
 * 1. 缓冲 logStore 推送的日志条目，定时批量写入 PG
 * 2. G7: PG 不可用或写入失败时，fallback 到文件归档（debugFallbackWriter）
 * 3. G7: buffer 上限保护，防止内存溢出
 * 4. 告警持久化、过期清理委托给 debugPgWriter
 * 5. 冷数据查询委托给 debugArchiveReader
 *
 * 文件位置：server/shared/debugPersister/debugPersisterClass.js
 */

const crypto = require('crypto');
const { getArchivedByTraceId, listArchivedTraces } = require('../debugArchiveReader');
const { DebugPgWriter } = require('../debugPgWriter');
const logger = require('../logger');
const {
    FLUSH_INTERVAL_MS,
    FLUSH_BATCH_SIZE,
    RETENTION_DAYS,
    CLEANUP_INTERVAL_MS,
    BUFFER_FORCE_FALLBACK_THRESHOLD,
    CONSECUTIVE_FAILURES_THRESHOLD
} = require('./constants');

class DebugPersister {
    constructor() {
        this._pool = null;
        this._pgWriter = null;
        this._buffer = [];
        this._flushTimer = null;
        this._cleanupTimer = null;
        this._isFlushing = false;
        this._totalWritten = 0;
        this._totalErrors = 0;
        this._fallbackWriter = null;
        this._consecutiveFailures = 0;
        this._fallbackWritten = 0;
    }

    attachPool(pool) {
        this._pool = pool;
        this._pgWriter = new DebugPgWriter(pool);
    }

    /** G7: 注入文件归档 fallback writer */
    attachFallbackWriter(writer) { this._fallbackWriter = writer; }

    start() {
        if (!this._pool) {
            logger.error('debugPersister', '[debugPersister] Cannot start: PG pool not attached');
            return;
        }
        if (this._flushTimer) return;
        this._flushTimer = setInterval(() => this.flush().catch(() => {}), FLUSH_INTERVAL_MS);
        if (this._flushTimer.unref) this._flushTimer.unref();
        this._cleanupTimer = setInterval(() => this.cleanup().catch(() => {}), CLEANUP_INTERVAL_MS);
        if (this._cleanupTimer.unref) this._cleanupTimer.unref();
        this.cleanup().catch(() => {});
    }

    async stop() {
        if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null; }
        if (this._cleanupTimer) { clearInterval(this._cleanupTimer); this._cleanupTimer = null; }
        await this.flush();
    }

    /** 接收 logStore 推送的日志条目 */
    pushLog(traceId, entry) {
        // G7: PG 不可用 或 连续失败次数过多 → 直接走 fallback
        if (!this._pool || this._consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
            this._writeToFallback(traceId, entry);
            return;
        }
        // G7: buffer 上限保护 → 转 fallback，防止内存溢出
        if (this._buffer.length >= BUFFER_FORCE_FALLBACK_THRESHOLD) {
            this._writeToFallback(traceId, entry);
            return;
        }
        this._buffer.push({
            id: crypto.randomUUID(),
            traceId: traceId || 'no-trace',
            timestamp: entry.timestamp || new Date().toISOString(),
            level: entry.level,
            module: entry.module || 'unknown',
            message: entry.message,
            context: entry.context || null
        });
        if (this._buffer.length >= FLUSH_BATCH_SIZE) {
            this.flush().catch(() => {});
        }
    }

    _writeToFallback(traceId, entry) {
        if (!this._fallbackWriter) return;
        if (this._fallbackWriter.write(traceId, entry)) this._fallbackWritten++;
    }

    /** 刷新缓冲区到 PG，失败转 fallback */
    async flush() {
        if (this._isFlushing || this._buffer.length === 0) return;
        if (!this._pool) { this._flushBufferToFallback(); return; }

        this._isFlushing = true;
        const batch = this._buffer.splice(0, FLUSH_BATCH_SIZE);
        try {
            await this._pgWriter.writeBatch(batch);
            this._totalWritten += batch.length;
            this._consecutiveFailures = 0;
        } catch (e) {
            this._totalErrors++;
            this._consecutiveFailures++;
            this._writeBatchToFallback(batch);
            logger.error('debugPersister', `[debugPersister] flush failed, fallback to file: ${e.message}`);
        } finally {
            this._isFlushing = false;
        }
        if (this._buffer.length >= FLUSH_BATCH_SIZE) {
            this.flush().catch(() => {});
        }
    }

    _flushBufferToFallback() {
        if (this._buffer.length === 0) return;
        const batch = this._buffer.splice(0, this._buffer.length);
        this._writeBatchToFallback(batch);
    }

    _writeBatchToFallback(batch) {
        if (!this._fallbackWriter || batch.length === 0) return;
        const success = this._fallbackWriter.writeBatch(batch);
        this._fallbackWritten += success;
        if (success < batch.length) {
            logger.warn('debugPersister', `[debugPersister] fallback partial: ${success}/${batch.length} written`);
        }
    }

    async persistAlert(alert) {
        if (!this._pgWriter) return;
        await this._pgWriter.persistAlert(alert);
    }

    async deleteAlert(alertId) {
        if (!this._pgWriter) return;
        await this._pgWriter.deleteAlert(alertId);
    }

    async cleanup() {
        if (!this._pgWriter) return;
        await this._pgWriter.cleanup(RETENTION_DAYS);
    }

    async getArchivedByTraceId(traceId, opts = {}) {
        return getArchivedByTraceId(this._pool, traceId, opts);
    }

    async listArchivedTraces(opts = {}) {
        return listArchivedTraces(this._pool, opts);
    }

    getStats() {
        return {
            enabled: !!this._pool,
            fallbackEnabled: !!this._fallbackWriter,
            bufferLength: this._buffer.length,
            flushIntervalMs: FLUSH_INTERVAL_MS,
            flushBatchSize: FLUSH_BATCH_SIZE,
            retentionDays: RETENTION_DAYS,
            totalWritten: this._totalWritten,
            totalErrors: this._totalErrors,
            consecutiveFailures: this._consecutiveFailures,
            fallbackWritten: this._fallbackWritten,
            fallbackStats: this._fallbackWriter ? this._fallbackWriter.getStats() : null
        };
    }
}

module.exports = { DebugPersister };
