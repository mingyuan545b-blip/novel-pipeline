'use strict';

/**
 * 性能基线 CI 检测脚本（Q6）
 *
 * 职责：
 * 1. 测量核心模块加载时间、内存占用、模块缓存数
 * 2. 对比阈值，超阈值输出 WARNING / ERROR
 * 3. 输出 JSON 报告供 CI 记录
 * 4. 严重超标时 exit 1 阻塞 CI，轻度超标 exit 0 仅警告
 *
 * 阈值设计原则：
 * - 阈值宽松（CI 机器性能差异大），仅捕获严重退化
 * - 单模块加载 > 2s 视为 ERROR（可能存在循环依赖或重 IO）
 * - 总加载时间 > 10s 视为 ERROR
 * - 模块缓存数 > 1000 视为 WARNING（可能存在重复 require）
 *
 * 文件位置：scripts/perfBaselineCheck.js
 */

const path = require('path');
const v8 = require('v8');

const SERVER_ROOT = path.join(__dirname, '..', 'server');

// 阈值常量（禁止硬编码魔法数字 — 集中定义）
const THRESHOLDS = Object.freeze({
    SINGLE_MODULE_LOAD_MS_ERROR: 2000,
    SINGLE_MODULE_LOAD_MS_WARN: 1000,
    TOTAL_LOAD_MS_ERROR: 10000,
    TOTAL_LOAD_MS_WARN: 5000,
    CACHED_MODULES_WARN: 1000,
    CACHED_MODULES_ERROR: 2000,
    HEAP_USED_MB_ERROR: 500,
    HEAP_USED_MB_WARN: 200
});

const CORE_MODULES = [
    'store', 'services/llm', 'services/llmConfig', 'services/llmMetrics',
    'services/pipelineMetrics', 'services/license', 'services/rateLimiter',
    'shared/logger', 'shared/errors', 'config/providerRegistry',
    'config/envValidator', 'config/configManifest'
];

function measureModuleLoad(modPath) {
    const before = process.memoryUsage();
    const start = Date.now();
    try {
        require(modPath);
        const elapsed = Date.now() - start;
        const after = process.memoryUsage();
        return {
            module: path.relative(SERVER_ROOT, modPath),
            loadMs: elapsed,
            heapDeltaKB: Math.round((after.heapUsed - before.heapUsed) / 1024),
            ok: true
        };
    } catch (e) {
        return {
            module: path.relative(SERVER_ROOT, modPath),
            loadMs: -1,
            heapDeltaKB: 0,
            ok: false,
            error: e.message
        };
    }
}

function runCheck() {
    const errors = [];
    const warnings = [];
    const moduleResults = [];

    // 1. 核心模块加载时间
    for (const mod of CORE_MODULES) {
        const result = measureModuleLoad(path.join(SERVER_ROOT, mod));
        moduleResults.push(result);
        if (!result.ok) {
            errors.push(`module ${result.module} load failed: ${result.error}`);
        } else if (result.loadMs > THRESHOLDS.SINGLE_MODULE_LOAD_MS_ERROR) {
            errors.push(`module ${result.module} load ${result.loadMs}ms > ${THRESHOLDS.SINGLE_MODULE_LOAD_MS_ERROR}ms (ERROR)`);
        } else if (result.loadMs > THRESHOLDS.SINGLE_MODULE_LOAD_MS_WARN) {
            warnings.push(`module ${result.module} load ${result.loadMs}ms > ${THRESHOLDS.SINGLE_MODULE_LOAD_MS_WARN}ms (WARN)`);
        }
    }

    // 2. 总加载时间
    const totalLoadMs = moduleResults.reduce((s, r) => s + (r.loadMs > 0 ? r.loadMs : 0), 0);
    if (totalLoadMs > THRESHOLDS.TOTAL_LOAD_MS_ERROR) {
        errors.push(`total load ${totalLoadMs}ms > ${THRESHOLDS.TOTAL_LOAD_MS_ERROR}ms (ERROR)`);
    } else if (totalLoadMs > THRESHOLDS.TOTAL_LOAD_MS_WARN) {
        warnings.push(`total load ${totalLoadMs}ms > ${THRESHOLDS.TOTAL_LOAD_MS_WARN}ms (WARN)`);
    }

    // 3. 模块缓存数
    const cachedModules = Object.keys(require.cache).filter(k => k.includes('server'));
    if (cachedModules.length > THRESHOLDS.CACHED_MODULES_ERROR) {
        errors.push(`cached modules ${cachedModules.length} > ${THRESHOLDS.CACHED_MODULES_ERROR} (ERROR)`);
    } else if (cachedModules.length > THRESHOLDS.CACHED_MODULES_WARN) {
        warnings.push(`cached modules ${cachedModules.length} > ${THRESHOLDS.CACHED_MODULES_WARN} (WARN)`);
    }

    // 4. 堆内存
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / (1024 * 1024));
    if (heapUsedMB > THRESHOLDS.HEAP_USED_MB_ERROR) {
        errors.push(`heap used ${heapUsedMB}MB > ${THRESHOLDS.HEAP_USED_MB_ERROR}MB (ERROR)`);
    } else if (heapUsedMB > THRESHOLDS.HEAP_USED_MB_WARN) {
        warnings.push(`heap used ${heapUsedMB}MB > ${THRESHOLDS.HEAP_USED_MB_WARN}MB (WARN)`);
    }

    const report = {
        timestamp: new Date().toISOString(),
        passed: errors.length === 0,
        errors,
        warnings,
        summary: {
            totalLoadMs,
            cachedModules: cachedModules.length,
            heapUsedMB,
            heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024)),
            rssMB: Math.round(mem.rss / (1024 * 1024)),
            heapSizeLimitMB: Math.round(v8.getHeapStatistics().heap_size_limit / (1024 * 1024))
        },
        modules: moduleResults,
        thresholds: THRESHOLDS
    };

    return report;
}

// 直接执行时输出报告
if (require.main === module) {
    const report = runCheck();
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) {
        console.error(`\n[PERF] ❌ ${report.errors.length} errors:`);
        for (const e of report.errors) console.error(`  - ${e}`);
        process.exit(1);
    }
    if (report.warnings.length > 0) {
        console.warn(`\n[PERF] ⚠️ ${report.warnings.length} warnings:`);
        for (const w of report.warnings) console.warn(`  - ${w}`);
    }
    console.log(`\n[PERF] ✓ Baseline OK (total ${report.summary.totalLoadMs}ms, ${report.summary.cachedModules} cached, ${report.summary.heapUsedMB}MB heap)`);
    process.exit(0);
}

module.exports = { runCheck, THRESHOLDS, CORE_MODULES };
