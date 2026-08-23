/**
 * perfBaseline.js
 * 性能基线测量 — 模块加载时间、内存占用、测试执行时间
 */
const path = require('path');
const v8 = require('v8');

const SERVER_ROOT = path.join(__dirname, '..', '..', 'server');

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
            heapDeltaKB: Math.round((after.heapUsed - before.heapUsed) / 1024)
        };
    } catch (e) {
        return { module: path.relative(SERVER_ROOT, modPath), loadMs: -1, error: e.message };
    }
}

function formatKB(kb) {
    if (kb < 0) return `${kb}KB`;
    if (kb < 1024) return `${kb}KB`;
    return `${(kb / 1024).toFixed(1)}MB`;
}

// === 1. 核心模块加载时间 ===
console.log('\n=== 1. 核心模块加载时间 ===');
const coreModules = [
    'store', 'services/llm', 'services/llmConfig', 'services/llmMetrics',
    'services/pipelineMetrics', 'services/license', 'services/rateLimiter',
    'shared/logger', 'shared/errors', 'config/providerRegistry',
    'config/envValidator', 'config/configManifest'
];
const coreResults = [];
for (const mod of coreModules) {
    const result = measureModuleLoad(path.join(SERVER_ROOT, mod));
    coreResults.push(result);
    console.log(`  ${result.loadMs >= 0 ? result.loadMs + 'ms' : 'FAIL'}  ${result.module}`);
}

// === 2. Pipeline步骤加载时间 ===
console.log('\n=== 2. Pipeline步骤加载时间 ===');
const pipelineSteps = [
    'core/pipeline/steps/BaseStep', 'core/pipeline/steps/StepRegistry',
    'core/pipeline/steps/WriterStep', 'core/pipeline/steps/FirstReviewStep',
    'core/pipeline/steps/SecondReviewStep', 'core/pipeline/steps/FinalEditorStep',
    'core/pipeline/steps/PolisherStep', 'core/pipeline/steps/MaterialManagerStep'
];
for (const mod of pipelineSteps) {
    const result = measureModuleLoad(path.join(SERVER_ROOT, mod));
    console.log(`  ${result.loadMs >= 0 ? result.loadMs + 'ms' : 'FAIL'}  ${result.module}`);
}

// === 3. 内存快照 ===
console.log('\n=== 3. 内存快照 ===');
const mem = process.memoryUsage();
console.log(`  RSS: ${formatKB(Math.round(mem.rss / 1024))}`);
console.log(`  Heap Used: ${formatKB(Math.round(mem.heapUsed / 1024))}`);
console.log(`  Heap Total: ${formatKB(Math.round(mem.heapTotal / 1024))}`);
console.log(`  External: ${formatKB(Math.round(mem.external / 1024))}`);

// === 4. 堆统计 ===
console.log('\n=== 4. 堆统计 ===');
const heapStats = v8.getHeapStatistics();
console.log(`  Heap Size Limit: ${formatKB(Math.round(heapStats.heap_size_limit / 1024))}`);
console.log(`  Used Heap Size: ${formatKB(Math.round(heapStats.used_heap_size / 1024))}`);

// === 5. 模块缓存统计 ===
console.log('\n=== 5. 模块缓存统计 ===');
const cachedModules = Object.keys(require.cache).filter(k => k.includes('server'));
console.log(`  Cached modules: ${cachedModules.length}`);

// === 6. 性能基线摘要 ===
console.log('\n=== 6. 性能基线摘要 ===');
const totalLoadMs = coreResults.reduce((sum, r) => sum + (r.loadMs >= 0 ? r.loadMs : 0), 0);
console.log(`  Core modules total load: ${totalLoadMs}ms`);
console.log(`  Heap used: ${formatKB(Math.round(mem.heapUsed / 1024))}`);
console.log(`  Cached modules: ${cachedModules.length}`);
console.log(`  Baseline date: ${new Date().toISOString()}`);
