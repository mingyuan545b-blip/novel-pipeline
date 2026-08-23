/**
 * metricsPersistence.js — Metrics持久化与告警
 * 定期将pipelineMetrics和llmMetrics快照保存到store
 * 提供告警规则：高失败率、配额耗尽预测
 */
const logger = require('../shared/logger');
const pipelineMetrics = require('./pipelineMetrics');
const llmMetrics = require('./llmMetrics');

const STORE_TYPE = 'metrics-snapshots';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SNAPSHOTS = 288;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

let store = null;
let snapshotTimer = null;
let lastAlertAt = {};

function _ensureStore() {
    if (!store) { store = require('../store'); }
    return store;
}

function takeSnapshot() {
    const ts = new Date().toISOString();
    const pipelineData = pipelineMetrics.getAllMetrics();
    const llmData = llmMetrics.getAllProviderMetrics();
    return { ts, pipeline: pipelineData, llm: llmData };
}

async function persistSnapshot() {
    try {
        const s = _ensureStore();
        const snapshot = takeSnapshot();
        const existing = await s.getItem(STORE_TYPE, 'latest');
        const arr = Array.isArray(existing) ? existing : [];
        arr.push(snapshot);
        if (arr.length > MAX_SNAPSHOTS) {
            arr.splice(0, arr.length - MAX_SNAPSHOTS);
        }
        await s.setItem(STORE_TYPE, 'latest', arr);
        logger.info('metricsPersistence', `Snapshot persisted (${arr.length} total)`);
    } catch (e) {
        logger.error('metricsPersistence', 'Failed to persist snapshot', e.message);
    }
}

async function loadHistoricalSnapshots() {
    try {
        const s = _ensureStore();
        const data = await s.getItem(STORE_TYPE, 'latest');
        return Array.isArray(data) ? data : [];
    } catch (_e) {
        return [];
    }
}

function checkAlerts() {
    const now = Date.now();
    const llmData = llmMetrics.getAllProviderMetrics();
    const SLOW_THRESHOLD_MS = llmMetrics.SLOW_REQUEST_MS;
    for (const [key, stats] of Object.entries(llmData)) {
        if (stats.requestCount < 5) continue;
        const failureRate = stats.failureCount / stats.requestCount;
        if (failureRate > 0.3) {
            const alertKey = `high-failure:${key}`;
            if (!lastAlertAt[alertKey] || (now - lastAlertAt[alertKey]) > ALERT_COOLDOWN_MS) {
                lastAlertAt[alertKey] = now;
                logger.warn('metricsAlert', `${key} failure rate ${(failureRate * 100).toFixed(1)}% (>${30}%)`);
            }
        }
        // M1：慢请求告警（p95 超过阈值）
        if ((stats.p95LatencyMs || 0) >= SLOW_THRESHOLD_MS) {
            const alertKey = `slow-llm:${key}`;
            if (!lastAlertAt[alertKey] || (now - lastAlertAt[alertKey]) > ALERT_COOLDOWN_MS) {
                lastAlertAt[alertKey] = now;
                logger.warn('metricsAlert', `${key} p95 latency ${stats.p95LatencyMs}ms (>=${SLOW_THRESHOLD_MS}ms), slow requests: ${stats.slowRequestCount}`);
            }
        }
    }
    const pipelineData = pipelineMetrics.getAllMetrics();
    for (const [stepName, stats] of Object.entries(pipelineData)) {
        if (stats.count < 3) continue;
        const failureRate = stats.failures / stats.count;
        if (failureRate > 0.5) {
            const alertKey = `step-failure:${stepName}`;
            if (!lastAlertAt[alertKey] || (now - lastAlertAt[alertKey]) > ALERT_COOLDOWN_MS) {
                lastAlertAt[alertKey] = now;
                logger.warn('metricsAlert', `Step ${stepName} failure rate ${(failureRate * 100).toFixed(1)}% (>${50}%)`);
            }
        }
    }
}

function predictQuotaExhaustion(hourlyTokenRate, quotaLimit) {
    if (!hourlyTokenRate || !quotaLimit) return null;
    const hoursRemaining = quotaLimit / hourlyTokenRate;
    const exhaustAt = new Date(Date.now() + hoursRemaining * 3600000);
    return { hoursRemaining: Math.round(hoursRemaining * 10) / 10, exhaustAt: exhaustAt.toISOString() };
}

function startPersistence() {
    if (snapshotTimer) return;
    snapshotTimer = setInterval(async () => {
        await persistSnapshot();
        checkAlerts();
    }, SNAPSHOT_INTERVAL_MS);
    logger.info('metricsPersistence', `Started (interval=${SNAPSHOT_INTERVAL_MS / 1000}s, max=${MAX_SNAPSHOTS})`);
}

function stopPersistence() {
    if (snapshotTimer) {
        clearInterval(snapshotTimer);
        snapshotTimer = null;
    }
}

module.exports = {
    takeSnapshot, persistSnapshot, loadHistoricalSnapshots,
    checkAlerts, predictQuotaExhaustion,
    startPersistence, stopPersistence
};
