/**
 * e2eSmokeTest.js
 * 端到端冒烟测试 — 验证模块加载、路由注册、Pipeline步骤可用性
 */
const path = require('path');
const fs = require('fs');

const SERVER_ROOT = path.join(__dirname, '..', '..', 'server');
let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, msg) {
    if (condition) { passed++; }
    else { failed++; errors.push(msg); }
}

// === 1. 核心模块加载 ===
console.log('\n=== 1. 核心模块加载 ===');
const coreModules = [
    'store', 'services/llm', 'services/llmConfig', 'services/llmMetrics',
    'services/pipelineMetrics', 'services/license', 'services/rateLimiter',
    'shared/logger', 'shared/errors', 'config/providerRegistry',
    'config/envValidator', 'config/configManifest'
];
for (const mod of coreModules) {
    try {
        require(path.join(SERVER_ROOT, mod));
        assert(true, ''); console.log(`  ✅ ${mod}`);
    } catch (e) {
        assert(false, `${mod}: ${e.message}`); console.log(`  ❌ ${mod}: ${e.message}`);
    }
}

// === 2. 路由模块加载 ===
console.log('\n=== 2. 路由模块加载 ===');
const routeModules = [
    'routes/projects', 'routes/chapters', 'routes/pipeline', 'routes/settings',
    'routes/health', 'routes/authRoutes', 'routes/apiKeys', 'routes/licenseRoutes',
    'routes/versionRoutes', 'routes/genre-debug', 'routes/materials',
    'routes/reviews', 'routes/agents', 'routes/guide', 'routes/workshop',
    'routes/publish', 'routes/comic', 'routes/quests', 'routes/style-templates',
    'routes/knowledge', 'routes/franchises', 'routes/map',
    'routes/worldview-profiles', 'routes/library', 'routes/prompt-config',
    'routes/optimizer', 'routes/chapterAudit', 'routes/flavors',
    'routes/characterStates', 'routes/entityCenter', 'routes/worldscopeRoutes'
];
for (const mod of routeModules) {
    try {
        require(path.join(SERVER_ROOT, mod));
        assert(true, ''); console.log(`  ✅ ${mod}`);
    } catch (e) {
        assert(false, `${mod}: ${e.message}`); console.log(`  ❌ ${mod}: ${e.message}`);
    }
}

// === 3. Pipeline步骤模块加载 ===
console.log('\n=== 3. Pipeline步骤模块加载 ===');
const pipelineSteps = [
    'core/pipeline/steps/BaseStep',
    'core/pipeline/steps/StepRegistry',
    'core/pipeline/steps/StepResult',
    'core/pipeline/steps/WriterStep',
    'core/pipeline/steps/FirstReviewStep',
    'core/pipeline/steps/SecondReviewStep',
    'core/pipeline/steps/FinalEditorStep',
    'core/pipeline/steps/PolisherStep',
    'core/pipeline/steps/MaterialManagerStep',
    'core/pipeline/steps/ReaderStep',
    'services/pipeline/pipelineStepRunner',
    'services/pipeline/pipelineContract',
    'services/pipeline/pipelinePreflight',
    'services/pipeline/pipelinePollutionGuard'
];
for (const mod of pipelineSteps) {
    try {
        require(path.join(SERVER_ROOT, mod));
        assert(true, ''); console.log(`  ✅ ${mod}`);
    } catch (e) {
        assert(false, `${mod}: ${e.message}`); console.log(`  ❌ ${mod}: ${e.message}`);
    }
}

// === 4. 题材插件加载 ===
console.log('\n=== 4. 题材插件加载 ===');
const genreDir = path.join(SERVER_ROOT, 'services', 'genre');
if (fs.existsSync(genreDir)) {
    const genreDirs = fs.readdirSync(genreDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);
    for (const genre of genreDirs) {
        const indexPath = path.join(genreDir, genre, 'index.js');
        if (fs.existsSync(indexPath)) {
            try {
                require(indexPath);
                assert(true, ''); console.log(`  ✅ genre/${genre}`);
            } catch (e) {
                assert(false, `genre/${genre}: ${e.message}`); console.log(`  ❌ genre/${genre}: ${e.message}`);
            }
        }
    }
} else {
    console.log('  ⚠️ genre directory not found');
}

// === 5. 工具模块加载 ===
console.log('\n=== 5. 工具模块加载 ===');
const utilModules = [
    'utils/lazyRoute', 'utils/processGuard', 'middleware/errorHandler', 'middleware/apiResponse',
    'middleware/auth', 'middleware/sensitiveFilter', 'middleware/securityHeaders',
    'middleware/inputSanitizer', 'services/dataContext', 'services/memory',
    'services/genreConfig', 'services/genreDetectorHelpers'
];
for (const mod of utilModules) {
    try {
        require(path.join(SERVER_ROOT, mod));
        assert(true, ''); console.log(`  ✅ ${mod}`);
    } catch (e) {
        assert(false, `${mod}: ${e.message}`); console.log(`  ❌ ${mod}: ${e.message}`);
    }
}

// === 6. Pipeline契约完整性 ===
console.log('\n=== 6. Pipeline契约完整性 ===');
try {
    const contract = require(path.join(SERVER_ROOT, 'services', 'pipeline', 'pipelineContract'));
    const { STEP_ORDER, TERMINAL_STATUSES } = contract.PIPELINE_CONTRACT || contract;
    assert(Array.isArray(STEP_ORDER), 'STEP_ORDER should be array');
    assert(Array.isArray(TERMINAL_STATUSES), 'TERMINAL_STATUSES should be array');
    assert(STEP_ORDER.length >= 8, `STEP_ORDER >=8, got ${STEP_ORDER.length}`);
    assert(TERMINAL_STATUSES.includes('approved'), 'approved should be terminal');
    console.log(`  ✅ STEP_ORDER: ${STEP_ORDER.length} steps`);
    console.log(`  ✅ TERMINAL_STATUSES: ${TERMINAL_STATUSES.join(', ')}`);
} catch (e) {
    assert(false, `Pipeline contract: ${e.message}`); console.log(`  ❌ ${e.message}`);
}

// === 7. 错误分类系统 ===
console.log('\n=== 7. 错误分类系统 ===');
try {
    const errorsMod = require(path.join(SERVER_ROOT, 'shared', 'errors'));
    assert(typeof errorsMod.isLLMOverloaded === 'function', 'isLLMOverloaded');
    assert(typeof errorsMod.isLLMTimeout === 'function', 'isLLMTimeout');
    assert(Array.isArray(errorsMod.OVERLOAD_PATTERNS), 'OVERLOAD_PATTERNS');
    console.log(`  ✅ OVERLOAD_PATTERNS: ${errorsMod.OVERLOAD_PATTERNS.length} patterns`);
} catch (e) {
    assert(false, `Error system: ${e.message}`); console.log(`  ❌ ${e.message}`);
}

// === 8. 配置清单完整性 ===
console.log('\n=== 8. 配置清单完整性 ===');
try {
    const manifest = require(path.join(SERVER_ROOT, 'config', 'configManifest'));
    assert(typeof manifest.CONFIG_MANIFEST === 'object', 'CONFIG_MANIFEST');
    const keys = Object.keys(manifest.CONFIG_MANIFEST);
    assert(keys.length >= 5, `CONFIG_MANIFEST >=5, got ${keys.length}`);
    console.log(`  ✅ CONFIG_MANIFEST: ${keys.length} entries`);
} catch (e) {
    assert(false, `Config manifest: ${e.message}`); console.log(`  ❌ ${e.message}`);
}

// === 9. Pipeline子路由模块加载 ===
console.log('\n=== 9. Pipeline子路由模块加载 ===');
const pipelineSubRoutes = [
    'routes/pipeline/coreRoutes', 'routes/pipeline/toolRoutes',
    'routes/pipeline/materialRoutes', 'routes/pipeline/pipelineExecutionRoutes',
    'routes/pipeline/pipelineDiagnosticRoutes',
    'routes/pipeline/contextCommanderRoutes'
];
for (const mod of pipelineSubRoutes) {
    try {
        require(path.join(SERVER_ROOT, mod));
        assert(true, ''); console.log(`  ✅ ${mod}`);
    } catch (e) {
        assert(false, `${mod}: ${e.message}`); console.log(`  ❌ ${mod}: ${e.message}`);
    }
}

// === 10. 进程守护模块 ===
console.log('\n=== 10. 进程守护模块 ===');
try {
    const guard = require(path.join(SERVER_ROOT, 'utils', 'processGuard'));
    assert(typeof guard.guardPort === 'function', 'guardPort');
    assert(typeof guard.isPortInUse === 'function', 'isPortInUse');
    console.log('  ✅ processGuard: guardPort + isPortInUse');
} catch (e) {
    assert(false, `processGuard: ${e.message}`); console.log(`  ❌ ${e.message}`);
}

// === Summary ===
console.log('\n' + '='.repeat(50));
console.log(`PASSED: ${passed}  |  FAILED: ${failed}`);
if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
}
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
