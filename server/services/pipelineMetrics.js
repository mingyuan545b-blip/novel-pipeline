'use strict';

/**
 * pipelineMetrics.js — Pipeline 步骤执行耗时指标
 *
 * 记录每个步骤的：
 * - 执行时间、成功/失败次数、最近执行历史
 * - 分位数 p50/p95/p99（M3：基于 lastExecutions 计算）
 *
 * 文件位置：server/services/pipelineMetrics.js
 */

const logger = require('../shared/logger');
const { computePercentiles } = require('../utils/percentile');

const MAX_HISTORY = 100;
const stepTimings = new Map();

function recordStepStart(stepName, projectId) {
    return { stepName, projectId, startTime: Date.now() };
}

function recordStepEnd(token, success = true) {
    if (!token || !token.stepName) return null;
    const { stepName, projectId, startTime } = token;
    const durationMs = Date.now() - startTime;

    if (!stepTimings.has(stepName)) {
        stepTimings.set(stepName, {
            totalMs: 0, count: 0, failures: 0, lastExecutions: []
        });
    }

    const stats = stepTimings.get(stepName);
    stats.totalMs += durationMs;
    stats.count += 1;
    if (!success) stats.failures += 1;

    stats.lastExecutions.push({
        projectId, durationMs, success, timestamp: new Date().toISOString()
    });
    if (stats.lastExecutions.length > MAX_HISTORY) {
        stats.lastExecutions.shift();
    }

    logger.info('pipelineMetrics', `[METRICS] ${stepName} ${durationMs}ms (ok=${success})`);
    return { stepName, durationMs, success };
}

/**
 * 从 stats 构建对外输出的指标对象（含分位数）
 */
function buildMetricsOutput(stepName, stats) {
    const durations = stats.lastExecutions.map(e => e.durationMs);
    const percentiles = computePercentiles(durations);
    return {
        stepName,
        totalMs: stats.totalMs,
        count: stats.count,
        failures: stats.failures,
        avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
        // M3：分位数
        p50Ms: percentiles.p50,
        p95Ms: percentiles.p95,
        p99Ms: percentiles.p99,
        recentExecutions: stats.lastExecutions.slice(-10)
    };
}

function getStepMetrics(stepName) {
    const stats = stepTimings.get(stepName);
    if (!stats) return null;
    return buildMetricsOutput(stepName, stats);
}

function getAllMetrics() {
    const result = {};
    for (const [stepName, stats] of stepTimings) {
        result[stepName] = buildMetricsOutput(stepName, stats);
    }
    return result;
}

/**
 * 获取最慢的 N 个步骤（按 p95 降序，M3）
 * @param {number} [limit=5] - 返回数量
 * @returns {Array<{stepName: string, p95Ms: number, avgMs: number, count: number}>}
 */
function getSlowestSteps(limit = 5) {
    const all = [];
    for (const [stepName, stats] of stepTimings) {
        if (stats.count === 0) continue;
        const durations = stats.lastExecutions.map(e => e.durationMs);
        const percentiles = computePercentiles(durations);
        all.push({
            stepName,
            p50Ms: percentiles.p50,
            p95Ms: percentiles.p95,
            p99Ms: percentiles.p99,
            avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
            count: stats.count
        });
    }
    all.sort((a, b) => b.p95Ms - a.p95Ms);
    return all.slice(0, limit);
}

function resetMetrics() {
    stepTimings.clear();
}

module.exports = {
    recordStepStart,
    recordStepEnd,
    getStepMetrics,
    getAllMetrics,
    getSlowestSteps,
    resetMetrics
};
