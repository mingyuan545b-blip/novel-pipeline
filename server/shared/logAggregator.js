'use strict';

/**
 * 错误聚合引擎
 *
 * 职责：
 * 1. 增量聚合：logStore.append 时同步更新聚合索引（O(1) 查询）
 * 2. 时间窗口：维护最近 N 分钟的错误计数（按分钟桶）
 * 3. 多维度聚合：按 module / level / code 聚合
 *
 * 设计权衡：
 * - 增量聚合：append 时 O(1) 更新，查询 O(1)
 * - 时间桶：每分钟一个桶，过期自动清理，支持任意窗口查询
 * - 仅聚合 warn/error 级别：info/debug 量大且无需告警
 *
 * 文件位置：server/shared/logAggregator.js
 */

// 默认聚合窗口（分钟）
const DEFAULT_WINDOW_MINUTES = parseInt(process.env.AGGREGATOR_WINDOW_MINUTES, 10) || 30;
// 时间桶大小（毫秒）— 1 分钟一个桶
const BUCKET_SIZE_MS = 60 * 1000;

/**
 * @typedef {Object} AggregationEntry
 * @property {string} key - 聚合键（如 "module:request" 或 "level:error"）
 * @property {number} count - 总计数
 * @property {number} firstSeen - 首次出现时间戳（ms）
 * @property {number} lastSeen - 最后出现时间戳（ms）
 * @property {Map<number, number>} buckets - 分钟桶 → 计数
 */

class LogAggregator {
    constructor(windowMinutes = DEFAULT_WINDOW_MINUTES) {
        this._windowMs = windowMinutes * 60 * 1000;
        /** @type {Map<string, AggregationEntry>} */
        this._aggregations = new Map();
        /** 已处理的最大日志时间戳，避免重复聚合 */
        this._lastProcessedTs = 0;
    }

    /**
     * 处理一条日志（增量更新聚合索引）
     * @param {import('./logStore').LogEntry} entry
     * @param {string} traceId
     */
    ingest(entry, traceId) {
        // 仅聚合 warn/error 级别
        if (entry.level !== 'warn' && entry.level !== 'error') return;

        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
        const bucketKey = Math.floor(ts / BUCKET_SIZE_MS);

        // 多维度聚合键
        const keys = [
            `level:${entry.level}`,
            `module:${entry.module || 'unknown'}`
        ];

        // 如果 context 中有 code 或 status，也作为聚合维度
        if (entry.context?.code) keys.push(`code:${entry.context.code}`);
        if (entry.context?.status && entry.context.status >= 400) {
            keys.push(`status:${entry.context.status}`);
        }

        for (const key of keys) {
            let entry_ = this._aggregations.get(key);
            if (!entry_) {
                entry_ = {
                    key,
                    count: 0,
                    firstSeen: ts,
                    lastSeen: ts,
                    buckets: new Map(),
                    sampleTraceId: traceId,
                    sampleMessage: entry.message
                };
                this._aggregations.set(key, entry_);
            }
            entry_.count++;
            entry_.lastSeen = ts;
            entry_.buckets.set(bucketKey, (entry_.buckets.get(bucketKey) || 0) + 1);
        }

        this._lastProcessedTs = ts;
        this._evictExpiredBuckets();
    }

    /**
     * 淘汰过期时间桶
     */
    _evictExpiredBuckets() {
        const cutoff = Math.floor((Date.now() - this._windowMs) / BUCKET_SIZE_MS);
        for (const entry of this._aggregations.values()) {
            for (const bucketKey of entry.buckets.keys()) {
                if (bucketKey < cutoff) {
                    const removed = entry.buckets.get(bucketKey);
                    entry.count = Math.max(0, entry.count - removed);
                    entry.buckets.delete(bucketKey);
                }
            }
            // 如果所有桶都过期，移除整个聚合项
            if (entry.count === 0 && entry.buckets.size === 0) {
                this._aggregations.delete(entry.key);
            }
        }
    }

    /**
     * 获取所有聚合数据（按 count 降序）
     * @param {Object} [opts] - { limit, minCount }
     * @returns {Array<AggregationEntry & { windowCount: number }>}
     */
    getAggregations(opts = {}) {
        const limit = opts.limit || 50;
        const minCount = opts.minCount || 1;
        this._evictExpiredBuckets();

        const items = [];
        for (const entry of this._aggregations.values()) {
            if (entry.count < minCount) continue;
            // 窗口内计数（最近 windowMs 内）
            const windowStart = Math.floor((Date.now() - this._windowMs) / BUCKET_SIZE_MS);
            let windowCount = 0;
            for (const [bucketKey, cnt] of entry.buckets) {
                if (bucketKey >= windowStart) windowCount += cnt;
            }
            items.push({
                key: entry.key,
                count: entry.count,
                windowCount,
                firstSeen: entry.firstSeen,
                lastSeen: entry.lastSeen,
                sampleTraceId: entry.sampleTraceId,
                sampleMessage: entry.sampleMessage
            });
        }
        items.sort((a, b) => b.count - a.count);
        return items.slice(0, limit);
    }

    /**
     * 获取指定聚合键的详情
     */
    getByKey(key) {
        const entry = this._aggregations.get(key);
        if (!entry) return null;
        return { ...entry, buckets: Object.fromEntries(entry.buckets) };
    }

    /**
     * 清空所有聚合数据
     */
    clear() {
        this._aggregations.clear();
        this._lastProcessedTs = 0;
    }

    /**
     * 获取聚合统计
     */
    getStats() {
        return {
            totalKeys: this._aggregations.size,
            windowMinutes: Math.floor(this._windowMs / 60000),
            lastProcessedTs: this._lastProcessedTs
        };
    }
}

// 单例
const logAggregator = new LogAggregator();

module.exports = {
    LogAggregator,
    logAggregator,
    DEFAULT_WINDOW_MINUTES
};
