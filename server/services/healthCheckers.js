const logger = require('../shared/logger');
const store = require('../store');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { HEALTH_MONITOR_CONFIG } = require('../config/systemConfig');
const { STATUS_VALUES } = require('./chapterStatus');

const { MAX_STUCK_CHAPTER_AGE } = HEALTH_MONITOR_CONFIG;
const MAX_ORPHAN_BROWSER_AGE = 30 * 60 * 1000;

async function checkStuckChapters() {
    const issues = [];
    try {
        const projects = await store.listItems('projects');
        for (const project of projects) {
            const chapters = await store.queryItems('chapters', { projectId: project.id });
            const stuck = chapters.filter(c => {
                if (c.status !== 'writing' && c.status !== 'reviewing') return false;
                const updated = new Date(c.updatedAt || c.createdAt);
                return (Date.now() - updated.getTime()) > MAX_STUCK_CHAPTER_AGE;
            });
            for (const c of stuck) {
                issues.push({ projectId: project.id, chapterId: c.id, chapterNumber: c.chapterNumber, status: c.status, stuckSince: c.updatedAt || c.createdAt });
            }
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=健康检查-磁盘探测 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return issues;
}

function checkOrphanBrowsers() {
    const issues = [];
    try {
        const PublisherBase = require('./publishers/PublisherBase');
        const browsers = PublisherBase.getAllBrowsers?.() || {};
        for (const [id, browser] of Object.entries(browsers)) {
            if (browser._openedAt && (Date.now() - browser._openedAt) > MAX_ORPHAN_BROWSER_AGE) {
                issues.push({ browserId: id, age: Date.now() - browser._openedAt });
            }
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return issues;
}

function checkDiskSpace() {
    const issues = [];
    try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (fs.existsSync(dataDir)) {
            const dbPath = path.join(dataDir, 'novel-pipeline.db');
            if (fs.existsSync(dbPath)) {
                const stat = fs.statSync(dbPath);
                const sizeMB = stat.size / (1024 * 1024);
                if (sizeMB > 500) {
                    issues.push({ type: 'database-size', sizeMB: Math.round(sizeMB), threshold: 500 });
                }
            }
            const files = fs.readdirSync(dataDir);
            const totalSize = files.reduce((sum, f) => {
                try { return sum + fs.statSync(path.join(dataDir, f)).size; } catch(_) { return sum; }
            }, 0);
            const totalMB = totalSize / (1024 * 1024);
            if (totalMB > 1000) {
                issues.push({ type: 'data-dir-size', sizeMB: Math.round(totalMB), threshold: 1000 });
            }
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=fs.statSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return issues;
}

function checkPipelineState() {
    const issues = [];
    try {
        const infiniteState = store.getItemSync?.('kv_store', 'infinite_pipeline_state');
        if (infiniteState && infiniteState.isRunning) {
            const lastUpdate = new Date(infiniteState.lastUpdate || infiniteState.startedAt);
            if (Date.now() - lastUpdate.getTime() > 60 * 60 * 1000) {
                issues.push({ type: 'stale-pipeline', projectId: infiniteState.projectId, lastUpdate: infiniteState.lastUpdate });
            }
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=if 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return issues;
}

function checkMemoryUsage() {
    const issues = [];
    const usage = process.memoryUsage();
    const heapMB = Math.round(usage.heapUsed / (1024 * 1024));
    const rssMB = Math.round(usage.rss / (1024 * 1024));
    if (heapMB > 512) issues.push({ type: 'heap-usage', heapMB, threshold: 512 });
    if (rssMB > 1024) issues.push({ type: 'rss-usage', rssMB, threshold: 1024 });
    return issues;
}

function checkDataIntegrity() {
    const issues = [];
    try {
        const projects = store.listItemsSync?.('projects') || [];
        for (const project of projects) {
            const chapters = store.queryItems?.('chapters', { projectId: project.id }) || [];
            const outlines = chapters.filter(c => c.status === STATUS_VALUES.OUTLINED);
            const written = chapters.filter(c => c.status === STATUS_VALUES.WRITTEN || c.status === STATUS_VALUES.APPROVED);
            if (outlines.length > 0 && written.length === 0 && chapters.length > 10) {
                issues.push({ type: 'no-progress', projectId: project.id, outlinedCount: outlines.length });
            }
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=for 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return issues;
}

function cleanupOldFiles() {
    const cleaned = [];
    try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) return cleaned;
        const now = Date.now();
        const MAX_LOG_AGE = HEALTH_MONITOR_CONFIG.MAX_LOG_AGE;

        for (const file of fs.readdirSync(dataDir)) {
            if (!file.endsWith('.log') && !file.endsWith('.tmp') && !file.endsWith('.bak')) continue;
            const filePath = path.join(dataDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > MAX_LOG_AGE) {
                    fs.unlinkSync(filePath);
                    cleaned.push(file);
                }
            } catch(_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=fs.statSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        }
    } catch (_) { logger.warn('healthMonitor', _.message || _); }  // DEGRADE: 影响=fs.statSync 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return cleaned;
}

/**
 * 陷阱#72防御：4类素材深度周期性校验
 * 由healthMonitor定时调用，检查所有项目的4类素材累计情况
 * 异常通过addAlert上报，避免人盯
 */
async function checkMaterialDepth() {
    const issues = [];
    try {
        const { checkProjectMaterials } = require('./pipeline/materialDepthChecker');
        const projects = await store.listItems('projects');
        for (const project of projects) {
            // 只检查有已写章节的项目
            const chapters = await store.queryItems('chapters', { projectId: project.id });
            const writtenChapters = chapters.filter(c =>
                c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED || c.status === STATUS_VALUES.WRITTEN
            );
            if (writtenChapters.length === 0) continue;

            const report = await checkProjectMaterials(project.id);
            if (!report.passed) {
                for (const issue of report.issues) {
                    issues.push({
                        type: 'material-depth',
                        projectId: project.id,
                        projectName: project.name,
                        issue,
                        level: report.issues.length >= 3 ? 'critical' : 'warning'
                    });
                }
            }
        }
    } catch (e) {
        logger.warn('healthMonitor', `checkMaterialDepth failed: ${e.message}`);
    }
    return issues;
}

module.exports = {
    checkStuckChapters, checkOrphanBrowsers, checkDiskSpace,
    checkPipelineState, checkMemoryUsage, checkDataIntegrity, cleanupOldFiles,
    checkMaterialDepth
};
