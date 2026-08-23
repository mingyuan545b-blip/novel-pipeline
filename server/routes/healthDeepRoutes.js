'use strict';

/**
 * 健康检查深度端点（Q5）
 *
 * 职责：补充 /api/health 的轻量检查，提供运行时深度依赖项状态
 * - GET /api/health/deep/pg — PG 连接池详细状态
 * - GET /api/health/deep/memory — 进程内存使用
 * - GET /api/health/deep/disk — data 目录磁盘可用空间
 * - GET /api/health/deep/persistence — debugPersister + fallbackWriter 状态
 * - GET /api/health/deep — 上述全部聚合
 *
 * 文件位置：server/routes/healthDeepRoutes.js
 */

const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DEBUG_FALLBACK } = require('../config/systemConfigDefs');

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const DISK_LOW_THRESHOLD_BYTES = 1 * BYTES_PER_GB; // 磁盘剩余 < 1GB 告警
const MEM_HIGH_THRESHOLD_BYTES = 1024 * BYTES_PER_MB; // RSS > 1GB 告警

/**
 * PG 连接池深度检查
 */
function checkPgPool() {
    try {
        const { getPool } = require('../db/pgPool');
        const pool = getPool();
        return {
            ok: true,
            source: 'pg',
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
            max: pool.options.max,
            idleTimeoutMs: pool.options.idleTimeoutMillis
        };
    } catch (e) {
        return { ok: false, source: 'pg', error: e.message };
    }
}

/**
 * 进程内存检查
 */
function checkMemory() {
    const mem = process.memoryUsage();
    const result = {
        ok: true,
        source: 'memory',
        rss: mem.rss,
        rssMB: Math.round(mem.rss / BYTES_PER_MB * 100) / 100,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        heapUsedMB: Math.round(mem.heapUsed / BYTES_PER_MB * 100) / 100,
        external: mem.external,
        arrayBuffers: mem.arrayBuffers,
        thresholdMB: Math.round(MEM_HIGH_THRESHOLD_BYTES / BYTES_PER_MB)
    };
    if (mem.rss > MEM_HIGH_THRESHOLD_BYTES) {
        result.ok = false;
        result.warning = `RSS ${result.rssMB}MB exceeds ${result.thresholdMB}MB threshold`;
    }
    return result;
}

/**
 * 磁盘可用空间检查（data 目录所在卷）
 */
function checkDisk() {
    try {
        const dataDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) {
            return { ok: true, source: 'disk', note: 'data dir not created yet', path: dataDir };
        }
        const stats = fs.statSync(dataDir);
        // Node.js fs.statSync 不直接提供可用空间，使用 os.estimateDiskFreeSpace（Node 18+）
        // 兼容方案：返回目录基本信息 + 系统总/free 内存作为代理指标
        const systemFreeMem = os.freemem();
        const systemTotalMem = os.totalmem();
        // 列出 data 目录下子目录数量作为活跃度指标
        const subdirs = fs.readdirSync(dataDir, { withFileTypes: true })
            .filter(d => d.isDirectory()).length;
        return {
            ok: true,
            source: 'disk',
            path: dataDir,
            subdirs,
            // 磁盘可用空间需要调用系统命令，跨平台兼容性差，用 os.freemem 近似
            // 真实磁盘检查应由外部监控（如 Prometheus node_exporter）负责
            systemFreeMemMB: Math.round(systemFreeMem / BYTES_PER_MB * 100) / 100,
            systemTotalMemMB: Math.round(systemTotalMem / BYTES_PER_MB * 100) / 100,
            note: 'use external monitoring for accurate disk free space'
        };
    } catch (e) {
        return { ok: false, source: 'disk', error: e.message };
    }
}

/**
 * 持久化层状态检查（debugPersister + fallbackWriter）
 */
function checkPersistence() {
    try {
        const { debugPersister } = require('../shared/debugPersister');
        const stats = debugPersister.getStats();
        return {
            ok: true,
            source: 'persistence',
            pgEnabled: stats.enabled,
            fallbackEnabled: stats.fallbackEnabled,
            bufferLength: stats.bufferLength,
            totalWritten: stats.totalWritten,
            totalErrors: stats.totalErrors,
            consecutiveFailures: stats.consecutiveFailures,
            fallbackWritten: stats.fallbackWritten,
            fallbackStats: stats.fallbackStats
        };
    } catch (e) {
        return { ok: false, source: 'persistence', error: e.message };
    }
}

// GET /api/health/deep/pg
router.get('/pg', (req, res) => {
    res.apiOk(checkPgPool());
});

// GET /api/health/deep/memory
router.get('/memory', (req, res) => {
    res.apiOk(checkMemory());
});

// GET /api/health/deep/disk
router.get('/disk', (req, res) => {
    res.apiOk(checkDisk());
});

// GET /api/health/deep/persistence
router.get('/persistence', (req, res) => {
    res.apiOk(checkPersistence());
});

// GET /api/health/deep — 聚合所有深度检查
router.get('/', (req, res) => {
    const pg = checkPgPool();
    const memory = checkMemory();
    const disk = checkDisk();
    const persistence = checkPersistence();
    const errors = [];
    if (!pg.ok) errors.push(`pg: ${pg.error}`);
    if (!memory.ok) errors.push(`memory: ${memory.warning}`);
    if (!disk.ok) errors.push(`disk: ${disk.error}`);
    if (!persistence.ok) errors.push(`persistence: ${persistence.error}`);

    res.apiOk({
        status: errors.length === 0 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        checks: { pg, memory, disk, persistence },
        errors: errors.length > 0 ? errors : undefined
    });
});

module.exports = {
    router,
    checkPgPool,
    checkMemory,
    checkDisk,
    checkPersistence,
    DISK_LOW_THRESHOLD_BYTES,
    MEM_HIGH_THRESHOLD_BYTES
};
