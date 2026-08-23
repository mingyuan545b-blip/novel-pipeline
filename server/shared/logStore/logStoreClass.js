'use strict';

/**
 * 日志环形缓冲存储类
 *
 * 职责：
 * 1. 在内存中按 traceId 索引日志条目（不依赖外部存储，重启清空）
 * 2. 提供按 traceId 检索、最近 traceId 列表查询
 * 3. 容量上限可配置，超出自动淘汰最旧数据
 *
 * 文件位置：server/shared/logStore/logStoreClass.js
 */

const { sinkState } = require('./sinkState');

// 默认容量上限（可通过环境变量覆盖）
const DEFAULT_MAX_TRACES = parseInt(process.env.LOG_STORE_MAX_TRACES, 10) || 500;
const DEFAULT_MAX_LOGS_PER_TRACE = parseInt(process.env.LOG_STORE_MAX_LOGS_PER_TRACE, 10) || 200;

class LogStore {
    constructor(maxTraces = DEFAULT_MAX_TRACES, maxLogsPerTrace = DEFAULT_MAX_LOGS_PER_TRACE) {
        this._maxTraces = maxTraces;
        this._maxLogsPerTrace = maxLogsPerTrace;
        /** @type {Map<string, TraceRecord>} */
        this._traces = new Map();
        /** 按创建时间排序的 traceId 队列（淘汰用） */
        this._traceQueue = [];
    }

    /**
     * 追加一条日志
     * @param {string} traceId - 追踪 ID（无 traceId 时使用常量 NO_TRACE）
     * @param {LogEntry} entry - 日志条目
     */
    append(traceId, entry) {
        const tid = traceId || 'no-trace';
        let record = this._traces.get(tid);
        if (!record) {
            record = {
                traceId: tid,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                logCount: 0,
                levelCounts: { debug: 0, info: 0, warn: 0, error: 0 },
                logs: []
            };
            this._traces.set(tid, record);
            this._traceQueue.push(tid);
            this._evictIfNeeded();
        }
        record.logs.push(entry);
        record.updatedAt = Date.now();
        record.logCount++;
        if (record.levelCounts[entry.level] !== undefined) {
            record.levelCounts[entry.level]++;
        }
        // 单 trace 日志上限：淘汰最旧
        if (record.logs.length > this._maxLogsPerTrace) {
            const removed = record.logs.shift();
            record.levelCounts[removed.level] = Math.max(0, record.levelCounts[removed.level] - 1);
        }

        // 增量更新聚合器（如果已注入）
        if (sinkState.aggregator) {
            try { sinkState.aggregator.ingest(entry, tid); } catch { /* 聚合失败不得影响主日志流 */ }
        }
        // 推送到持久化层（如果已注入）
        if (sinkState.persister) {
            try { sinkState.persister.pushLog(tid, entry); } catch { /* 持久化失败不得影响主日志流 */ }
        }
    }

    /** 容量上限淘汰（FIFO） */
    _evictIfNeeded() {
        while (this._traceQueue.length > this._maxTraces) {
            const oldestTid = this._traceQueue.shift();
            this._traces.delete(oldestTid);
        }
    }

    /**
     * 按 traceId 检索日志
     * @param {string} traceId
     * @param {Object} [opts] - 可选过滤项 { level }
     * @returns {TraceRecord|null}
     */
    getByTraceId(traceId, opts = {}) {
        const record = this._traces.get(traceId);
        if (!record) return null;
        if (opts.level && record.levelCounts[opts.level] !== undefined) {
            return { ...record, logs: record.logs.filter(e => e.level === opts.level) };
        }
        return { ...record, logs: [...record.logs] };
    }

    /**
     * 列出最近 traceId（按 updatedAt 降序）
     * @param {Object} [opts] - { limit, level }
     */
    listRecentTraces(opts = {}) {
        const limit = opts.limit || 50;
        const level = opts.level;
        const items = [];
        for (const record of this._traces.values()) {
            if (level && record.levelCounts[level] === 0) continue;
            items.push({
                traceId: record.traceId,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                logCount: record.logCount,
                levelCounts: { ...record.levelCounts },
                hasError: record.levelCounts.error > 0
            });
        }
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        return items.slice(0, limit);
    }

    /** 清空所有日志（仅内存，不影响 PG 归档） */
    clear() {
        this._traces.clear();
        this._traceQueue.length = 0;
        if (sinkState.aggregator) sinkState.aggregator.clear();
    }

    /** 获取统计信息 */
    getStats() {
        return {
            totalTraces: this._traces.size,
            maxTraces: this._maxTraces,
            maxLogsPerTrace: this._maxLogsPerTrace
        };
    }
}

module.exports = { LogStore, DEFAULT_MAX_TRACES, DEFAULT_MAX_LOGS_PER_TRACE };
