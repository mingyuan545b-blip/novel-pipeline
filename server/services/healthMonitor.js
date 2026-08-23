const logger = require('../shared/logger');
const store = require('../store');
const { HEALTH_MONITOR_CONFIG } = require('../config/systemConfig');
const { checkStuckChapters, checkOrphanBrowsers, checkDiskSpace, checkPipelineState, checkMemoryUsage, checkDataIntegrity, cleanupOldFiles, checkMaterialDepth } = require('./healthCheckers');

const { CHECK_INTERVAL_MS, CHECK_INTERVAL, MAX_ALERTS } = HEALTH_MONITOR_CONFIG;
const CHECK_INTERVAL_VALUE = CHECK_INTERVAL || CHECK_INTERVAL_MS || 60000;
if (!CHECK_INTERVAL && !CHECK_INTERVAL_MS) {
    logger.warn('healthMonitor', '[HEALTH] CHECK_INTERVAL not defined in config, using 60s default');
}

let checkTimer = null;
let lastCheckTime = null;
const alerts = [];

function addAlert(level, category, message) {
    const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        level, category, message, time: new Date().toISOString()
    };
    alerts.unshift(alert);
    if (alerts.length > MAX_ALERTS) alerts.length = MAX_ALERTS;
    const prefix = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
    logger.info('healthMonitor', `[HEALTH] ${prefix} [${category}] ${message}`);
    return alert;
}

async function runHealthCheck() {
    lastCheckTime = new Date().toISOString();

    const stuckChapters = await checkStuckChapters();
    for (const issue of stuckChapters) {
        addAlert('warning', 'stuck-chapter', `Chapter ${issue.chapterNumber} in ${issue.projectId} stuck in ${issue.status} since ${issue.stuckSince}`);
    }

    const orphanBrowsers = checkOrphanBrowsers();
    for (const issue of orphanBrowsers) {
        addAlert('warning', 'orphan-browser', `Browser ${issue.browserId} open for ${Math.round(issue.age / 60000)} minutes`);
    }

    const diskIssues = checkDiskSpace();
    for (const issue of diskIssues) {
        addAlert(issue.sizeMB > issue.threshold * 1.5 ? 'critical' : 'warning', 'disk-space', `${issue.type}: ${issue.sizeMB}MB (threshold: ${issue.threshold}MB)`);
    }

    const pipelineIssues = checkPipelineState();
    for (const issue of pipelineIssues) {
        addAlert('warning', 'stale-pipeline', `Pipeline for ${issue.projectId} stale since ${issue.lastUpdate}`);
    }

    const memoryIssues = checkMemoryUsage();
    for (const issue of memoryIssues) {
        addAlert(issue.type === 'heap-usage' && issue.heapMB > 768 ? 'critical' : 'warning', 'memory', `${issue.type}: ${issue.heapMB || issue.rssMB}MB`);
    }

    const integrityIssues = checkDataIntegrity();
    for (const issue of integrityIssues) {
        addAlert('info', 'data-integrity', `Project ${issue.projectId} has ${issue.outlinedCount} outlined chapters but none written`);
    }

    // 陷阱#72防御：4类素材深度周期性校验（避免人盯，异常自动告警）
    const materialDepthIssues = await checkMaterialDepth();
    for (const issue of materialDepthIssues) {
        addAlert(issue.level || 'warning', 'material-depth', `[${issue.projectName}] ${issue.issue}`);
    }

    const cleaned = cleanupOldFiles();
    if (cleaned.length > 0) {
        logger.info('healthMonitor', `[HEALTH] Cleaned ${cleaned.length} old files: ${cleaned.join(', ')}`);
    }

    return { checkedAt: lastCheckTime, issues: { stuckChapters: stuckChapters.length, orphanBrowsers: orphanBrowsers.length, disk: diskIssues.length, pipeline: pipelineIssues.length, memory: memoryIssues.length, integrity: integrityIssues.length, materialDepth: materialDepthIssues.length } };
}

function startHealthMonitor() {
    if (checkTimer) return;
    logger.info('healthMonitor', `[HEALTH] Starting health monitor (interval: ${CHECK_INTERVAL_VALUE}ms)`);
    runHealthCheck();
    checkTimer = setInterval(runHealthCheck, CHECK_INTERVAL_VALUE);
    checkTimer.unref?.();
}

function stopHealthMonitor() {
    if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
        logger.info('healthMonitor', '[HEALTH] Health monitor stopped');
    }
}

function getHealthStatus() {
    return {
        isRunning: checkTimer !== null,
        lastCheckTime,
        alertCount: alerts.length,
        criticalCount: alerts.filter(a => a.level === 'critical').length,
        warningCount: alerts.filter(a => a.level === 'warning').length,
        memoryUsage: process.memoryUsage()
    };
}

function getAlerts(options = {}) {
    let result = [...alerts];
    if (options.level) result = result.filter(a => a.level === options.level);
    if (options.category) result = result.filter(a => a.category === options.category);
    if (options.limit) result = result.slice(0, options.limit);
    return result;
}

function getActiveProjectIds() {
    try {
        const projects = store.listItemsSync?.('projects') || [];
        return projects.map(p => p.id);
    } catch (_) { return []; }
}

function cleanupStaleAlerts() {
    const MAX_AGE = HEALTH_MONITOR_CONFIG.MAX_LOG_AGE;
    const cutoff = Date.now() - MAX_AGE;
    const before = alerts.length;
    for (let i = alerts.length - 1; i >= 0; i--) {
        if (new Date(alerts[i].time).getTime() < cutoff) alerts.splice(i, 1);
    }
    return before - alerts.length;
}

module.exports = {
    addAlert, runHealthCheck, startHealthMonitor, stopHealthMonitor,
    getHealthStatus, getAlerts, getActiveProjectIds, cleanupStaleAlerts
};
