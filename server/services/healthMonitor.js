const store = require('../store');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHECK_INTERVAL = 5 * 60 * 1000;
const MAX_LOG_AGE = 24 * 60 * 60 * 1000;
const MAX_STUCK_CHAPTER_AGE = 2 * 60 * 60 * 1000;
const MAX_ORPHAN_BROWSER_AGE = 30 * 60 * 1000;

let checkTimer = null;
let lastCheckTime = null;
const alerts = [];
const MAX_ALERTS = 200;

function addAlert(level, category, message) {
    const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        level,
        category,
        message,
        time: new Date().toISOString()
    };
    alerts.unshift(alert);
    if (alerts.length > MAX_ALERTS) alerts.length = MAX_ALERTS;
    const prefix = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
    console.log(`[HEALTH] ${prefix} [${category}] ${message}`);
    return alert;
}

function checkStuckChapters() {
    try {
        const allChapters = store.listItems('chapters');
        const now = Date.now();
        let stuckCount = 0;

        for (const ch of allChapters) {
            const isProcessing = ['written', 'first-reviewing', 'second-reviewing', 'final-editing'].includes(ch.status);
            if (!isProcessing) continue;

            const updatedAt = ch.updatedAt ? new Date(ch.updatedAt).getTime() : 0;
            if (updatedAt > 0 && (now - updatedAt) > MAX_STUCK_CHAPTER_AGE) {
                stuckCount++;
                addAlert('warning', 'stuck-chapter',
                    `章节卡住: 项目${ch.projectId?.substring(0, 12)} 第${ch.chapterNumber}章 "${ch.title}" 状态=${ch.status} 已${Math.round((now - updatedAt) / 60000)}分钟未更新`);
            }
        }

        if (stuckCount === 0) return;
        addAlert('warning', 'stuck-chapter', `共${stuckCount}个章节可能卡住，建议检查流水线状态`);
    } catch (e) {
        addAlert('critical', 'stuck-chapter', `检查卡住章节失败: ${e.message}`);
    }
}

function checkOrphanBrowsers() {
    try {
        const result = require('child_process').execSync(
            'tasklist /FI "IMAGENAME eq chromium.exe" /FO CSV /NH 2>nul',
            { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        const lines = result.split('\n').filter(l => l.includes('chromium'));
        if (lines.length > 0) {
            const count = lines.length;
            if (count > 5) {
                addAlert('warning', 'orphan-browser', `检测到${count}个Chromium进程，可能存在孤儿浏览器`);
            }
        }
    } catch (e) { }
}

function checkDiskSpace() {
    try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        let totalSize = 0;
        let fileCount = 0;

        function calcDir(dir) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const full = path.join(dir, entry);
                try {
                    const stat = fs.statSync(full);
                    if (stat.isDirectory()) calcDir(full);
                    else { totalSize += stat.size; fileCount++; }
                } catch (e) { }
            }
        }
        calcDir(dataDir);

        const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
        if (totalSize > 500 * 1024 * 1024) {
            addAlert('warning', 'disk', `数据目录已达${sizeMB}MB (${fileCount}个文件)，建议清理`);
        }
    } catch (e) { }
}

function checkPipelineState() {
    try {
        const pipeline = require('./pipeline');
        const state = pipeline.getInfinitePipelineState?.();
        if (!state) return;

        for (const [projectId, s] of Object.entries(state)) {
            if (!s.running && s.logs && s.logs.length > 100) {
                addAlert('info', 'pipeline-cleanup', `项目${projectId.substring(0, 12)}流水线日志${s.logs.length}条，建议清理`);
            }
        }
    } catch (e) { }
}

function cleanupOldFiles() {
    try {
        const outputDir = path.join(__dirname, '..', '..', 'output');
        if (!fs.existsSync(outputDir)) return;

        const now = Date.now();
        const activeProjectIds = getActiveProjectIds();
        let cleanedCount = 0;

        function cleanDir(dir) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const full = path.join(dir, entry);
                try {
                    const stat = fs.statSync(full);
                    if (stat.isDirectory()) {
                        if (entry === '_tts_tmp') {
                            const age = now - stat.mtimeMs;
                            if (age > MAX_LOG_AGE) {
                                fs.rmSync(full, { recursive: true, force: true });
                                addAlert('info', 'cleanup', `清理TTS临时目录: ${entry}`);
                                cleanedCount++;
                                continue;
                            }
                        }
                        if (entry === 'comfyui_input') {
                            const age = now - stat.mtimeMs;
                            if (age > MAX_LOG_AGE) {
                                fs.rmSync(full, { recursive: true, force: true });
                                addAlert('info', 'cleanup', `清理ComfyUI输入目录: ${entry}`);
                                cleanedCount++;
                                continue;
                            }
                        }
                        const isProjectDir = entry.startsWith('proj_') || entry.match(/^[0-9a-f]{8}-/);
                        if (isProjectDir && !activeProjectIds.has(entry)) {
                            const age = now - stat.mtimeMs;
                            if (age > MAX_LOG_AGE) {
                                fs.rmSync(full, { recursive: true, force: true });
                                addAlert('info', 'cleanup', `清理孤儿项目输出目录: ${entry} (数据已不存在)`);
                                cleanedCount++;
                                continue;
                            }
                        }
                        cleanDir(full);
                        try {
                            if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
                        } catch (e) { }
                    } else if ((now - stat.mtimeMs) > MAX_LOG_AGE) {
                        if (full.endsWith('.log') || full.endsWith('.tmp') || full.startsWith('_test_')) {
                            fs.unlinkSync(full);
                            cleanedCount++;
                        }
                    }
                } catch (e) { }
            }
        }
        cleanDir(outputDir);
        if (cleanedCount > 0) {
            addAlert('info', 'cleanup', `清理了${cleanedCount}个过期文件/目录`);
        }
    } catch (e) { }
}

function getActiveProjectIds() {
    try {
        const projectsDir = path.join(__dirname, '..', '..', 'data', 'projects');
        if (!fs.existsSync(projectsDir)) return new Set();
        return new Set(
            fs.readdirSync(projectsDir)
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace('.json', ''))
        );
    } catch (e) {
        return new Set();
    }
}

function cleanupStaleAlerts() {
    const now = Date.now();
    for (let i = alerts.length - 1; i >= 0; i--) {
        const age = now - new Date(alerts[i].time).getTime();
        if (age > MAX_LOG_AGE) alerts.splice(i, 1);
    }
}

function checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapMB = (usage.heapUsed / 1024 / 1024).toFixed(0);
    const rssMB = (usage.rss / 1024 / 1024).toFixed(0);

    if (usage.heapUsed > 512 * 1024 * 1024) {
        addAlert('warning', 'memory', `内存使用过高: heap=${heapMB}MB rss=${rssMB}MB，建议重启服务`);
    }

    if (usage.rss > 1024 * 1024 * 1024) {
        addAlert('critical', 'memory', `RSS内存超1GB: ${rssMB}MB，存在内存泄漏风险`);
    }
}

function checkDataIntegrity() {
    try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) return;

        const subdirs = ['projects', 'materials', 'chapters', 'reviews'];
        for (const subdir of subdirs) {
            const dir = path.join(dataDir, subdir);
            if (!fs.existsSync(dir)) continue;

            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            let corruptCount = 0;

            for (const file of files.slice(0, 50)) {
                try {
                    const content = fs.readFileSync(path.join(dir, file), 'utf-8').replace(/^\uFEFF/, '');
                    JSON.parse(content);
                } catch (e) {
                    corruptCount++;
                    addAlert('critical', 'data-integrity',
                        `数据文件损坏: ${subdir}/${file} - ${e.message}`);
                }
            }

            if (corruptCount > 0) {
                addAlert('critical', 'data-integrity', `${subdir}目录有${corruptCount}个损坏的JSON文件`);
            }
        }
    } catch (e) {
        addAlert('warning', 'data-integrity', `数据完整性检查失败: ${e.message}`);
    }
}

function runHealthCheck() {
    lastCheckTime = new Date().toISOString();
    checkStuckChapters();
    checkOrphanBrowsers();
    checkDiskSpace();
    checkPipelineState();
    checkMemoryUsage();
    cleanupOldFiles();
    cleanupStaleAlerts();
}

function startHealthMonitor() {
    if (checkTimer) return;
    console.log('[HEALTH] 健康监控已启动 (每5分钟检查一次)');
    setTimeout(() => {
        runHealthCheck();
        checkTimer = setInterval(runHealthCheck, CHECK_INTERVAL);
    }, 30000);
}

function stopHealthMonitor() {
    if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
        console.log('[HEALTH] 健康监控已停止');
    }
}

function getHealthStatus() {
    return {
        lastCheckTime,
        alertCount: alerts.length,
        criticalCount: alerts.filter(a => a.level === 'critical').length,
        warningCount: alerts.filter(a => a.level === 'warning').length,
        memoryUsage: {
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0)}MB`,
            rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)}MB`,
            uptime: `${(process.uptime() / 3600).toFixed(1)}h`
        },
        recentAlerts: alerts.slice(0, 20)
    };
}

function getAlerts(options = {}) {
    const { level, category, limit = 50 } = options;
    let filtered = alerts;
    if (level) filtered = filtered.filter(a => a.level === level);
    if (category) filtered = filtered.filter(a => a.category === category);
    return filtered.slice(0, limit);
}

module.exports = {
    startHealthMonitor,
    stopHealthMonitor,
    runHealthCheck,
    getHealthStatus,
    getAlerts,
    addAlert
};
