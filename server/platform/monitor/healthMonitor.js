const os = require('os');
const fs = require('fs');
const path = require('path');
const { SERVER_DEFAULTS } = require('../../config/systemConfig');

const DATA_DIR = path.join(__dirname, '../../../data');

function getSystemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = os.loadavg();
    const uptime = process.uptime();
    const nodeVersion = process.version;
    const platform = os.platform();
    const arch = os.arch();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercent = ((usedMemory / totalMemory) * 100).toFixed(2);

    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        uptimeHuman: formatDuration(uptime),
        node: { version: nodeVersion, platform, arch },
        memory: {
            system: { total: formatBytes(totalMemory), used: formatBytes(usedMemory), free: formatBytes(freeMemory), usagePercent: memoryPercent },
            process: {
                rss: formatBytes(memUsage.rss),
                heapTotal: formatBytes(memUsage.heapTotal),
                heapUsed: formatBytes(memUsage.heapUsed),
                external: formatBytes(memUsage.external),
                arrayBuffers: formatBytes(memUsage.arrayBuffers)
            }
        },
        cpu: { load1: cpuUsage[0], load5: cpuUsage[1], load15: cpuUsage[2], cores: os.cpus().length },
        disk: getDiskUsage(),
        hostname: os.hostname()
    };
}

function getMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalSystem = os.totalmem();
    const freeSystem = os.freemem();

    return {
        process: {
            rss: { bytes: memUsage.rss, human: formatBytes(memUsage.rss) },
            heapTotal: { bytes: memUsage.heapTotal, human: formatBytes(memUsage.heapTotal) },
            heapUsed: { bytes: memUsage.heapUsed, human: formatBytes(memUsage.heapUsed) },
            external: { bytes: memUsage.external, human: formatBytes(memUsage.external) },
            arrayBuffers: { bytes: memUsage.arrayBuffers, human: formatBytes(memUsage.arrayBuffers) }
        },
        system: {
            total: { bytes: totalSystem, human: formatBytes(totalSystem) },
            free: { bytes: freeSystem, human: formatBytes(freeSystem) },
            used: { bytes: totalSystem - freeSystem, human: formatBytes(totalSystem - freeSystem) },
            usagePercent: (((totalSystem - freeSystem) / totalSystem) * 100).toFixed(2)
        },
        thresholds: {
            heapUsed: memUsage.heapUsed > 512 * 1024 * 1024 ? 'warning' : 'ok',
            rss: memUsage.rss > 1024 * 1024 * 1024 ? 'warning' : 'ok'
        }
    };
}

function getDiskUsage() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            return { dataDir: DATA_DIR, exists: false };
        }
        const stats = fs.statSync(DATA_DIR);
        const size = getDirSize(DATA_DIR);

        return {
            dataDir: DATA_DIR,
            exists: true,
            size: { bytes: size, human: formatBytes(size) },
            fileCount: countFiles(DATA_DIR)
        };
    } catch (e) {
        return { dataDir: DATA_DIR, error: e.message };
    }
}

function getProcessInfo() {
    const memUsage = process.memoryUsage();
    return {
        pid: process.pid,
        ppid: process.ppid,
        title: process.title || 'node',
        execPath: process.execPath,
        argv: process.argv,
        cwd: process.cwd(),
        env: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: process.env.PORT || String(SERVER_DEFAULTS.DEFAULT_PORT),
            LLM_PROVIDER: process.env.LLM_PROVIDER || 'not-set'
        },
        versions: {
            node: process.version,
            v8: process.versions.v8,
            uv: process.versions.uv,
            zlib: process.versions.zlib,
            openssl: process.versions.openssl
        },
        memory: {
            rss: formatBytes(memUsage.rss),
            heapUsed: formatBytes(memUsage.heapUsed),
            heapTotal: formatBytes(memUsage.heapTotal)
        },
        uptime: formatDuration(process.uptime())
    };
}

function formatHealthReport(health) {
    const lines = [];
    lines.push('=== System Health Report ===');
    lines.push(`Status: ${health.status}`);
    lines.push(`Uptime: ${health.uptimeHuman}`);
    lines.push(`Node: ${health.node.version} (${health.node.platform}/${health.node.arch})`);
    lines.push(`Memory: ${health.memory.process.rss} / ${health.memory.system.total} (${health.memory.system.usagePercent}%)`);
    lines.push(`CPU Load: ${health.cpu.load1} / ${health.cpu.load5} / ${health.cpu.load15} (${health.cpu.cores} cores)`);
    if (health.disk.size) {
        lines.push(`Data: ${health.disk.size.human} (${health.disk.fileCount} files)`);
    }
    lines.push(`Hostname: ${health.hostname}`);
    return lines.join('\n');
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirSize(dirPath) {
    let size = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                size += getDirSize(fullPath);
            } else {
                try {
                    size += fs.statSync(fullPath).size;
                } catch (_) { /* stat failed for single file, skip */ }
            }
        }
    } catch (_) { /* dir not accessible, return 0 */ }
    return size;
}

function countFiles(dirPath) {
    let count = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                count += countFiles(fullPath);
            } else {
                count++;
            }
        }
    } catch (_) { /* dir not accessible, return 0 */ }
    return count;
}

module.exports = {
    getSystemHealth,
    getMemoryUsage,
    getDiskUsage,
    getProcessInfo,
    formatHealthReport,
    formatDuration,
    formatBytes
};
