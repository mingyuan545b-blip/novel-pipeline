'use strict';

/**
 * llmMetrics.js — LLM 调用指标追踪
 *
 * 按 provider/model 聚合：
 * - Token 消耗（prompt/completion/total）
 * - 调用计数与失败计数
 * - 调用耗时（M1：durationMs，avgMs/maxMs/p95LatencyMs）
 * - 最近请求历史（含耗时）
 *
 * 文件位置：server/services/llmMetrics.js
 */

const { percentile } = require('../utils/percentile');

const MAX_HISTORY = 200;
const SLOW_REQUEST_MS = 30000; // 慢请求阈值（30 秒）

const providerStats = new Map();

/**
 * 记录一次 LLM 调用
 * @param {string} provider - 提供商名
 * @param {string} model - 模型名
 * @param {Object} [usage] - token 使用量 { prompt_tokens, completion_tokens, total_tokens }
 * @param {boolean} [success=true] - 是否成功
 * @param {number} [durationMs=0] - 调用耗时（毫秒，M1 新增）
 */
function recordTokenUsage(provider, model, usage, success = true, durationMs = 0) {
    const key = `${provider}/${model}`;
    if (!providerStats.has(key)) {
        providerStats.set(key, {
            promptTokens: 0, completionTokens: 0, totalTokens: 0,
            requestCount: 0, failureCount: 0,
            totalDurationMs: 0, maxDurationMs: 0, slowRequestCount: 0,
            lastRequests: []
        });
    }

    const stats = providerStats.get(key);
    stats.requestCount += 1;
    if (!success) stats.failureCount += 1;

    if (usage) {
        stats.promptTokens += usage.prompt_tokens || 0;
        stats.completionTokens += usage.completion_tokens || 0;
        stats.totalTokens += usage.total_tokens || 0;
    }

    // 耗时统计（M1）
    const dur = typeof durationMs === 'number' && durationMs > 0 ? Math.round(durationMs) : 0;
    if (dur > 0) {
        stats.totalDurationMs += dur;
        if (dur > stats.maxDurationMs) stats.maxDurationMs = dur;
        if (dur >= SLOW_REQUEST_MS) stats.slowRequestCount += 1;
    }

    stats.lastRequests.push({
        timestamp: new Date().toISOString(),
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        success,
        durationMs: dur
    });
    if (stats.lastRequests.length > MAX_HISTORY) {
        stats.lastRequests.shift();
    }
}

/**
 * 计算 p95 分位数（基于 lastRequests 的 durationMs，复用 percentile 工具）
 * @param {Object} stats - 单个 provider 的统计数据
 * @returns {number} p95 耗时（毫秒），无数据返回 0
 */
function computeP95Latency(stats) {
    const durations = stats.lastRequests
        .map(r => r.durationMs)
        .filter(d => d > 0);
    return percentile(durations, 0.95);
}

function getProviderMetrics(provider, model) {
    const key = `${provider}/${model}`;
    return providerStats.get(key) || null;
}

function getAllProviderMetrics() {
    const result = {};
    for (const [key, stats] of providerStats) {
        result[key] = {
            promptTokens: stats.promptTokens,
            completionTokens: stats.completionTokens,
            totalTokens: stats.totalTokens,
            requestCount: stats.requestCount,
            failureCount: stats.failureCount,
            // M1：耗时指标
            avgLatencyMs: stats.requestCount > 0
                ? Math.round(stats.totalDurationMs / stats.requestCount) : 0,
            maxLatencyMs: stats.maxDurationMs,
            p95LatencyMs: computeP95Latency(stats),
            slowRequestCount: stats.slowRequestCount,
            avgTokensPerRequest: stats.requestCount > 0
                ? Math.round(stats.totalTokens / stats.requestCount) : 0,
            recentRequests: stats.lastRequests.slice(-20)
        };
    }
    return result;
}

function resetMetrics() {
    providerStats.clear();
}

module.exports = {
    recordTokenUsage,
    getProviderMetrics,
    getAllProviderMetrics,
    resetMetrics,
    SLOW_REQUEST_MS
};
