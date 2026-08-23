/**
 * testPluginsVerify.js — 4个功能插件逐个+联动测试（入口文件）
 *
 * 架构：
 * - scripts/lib/apiClient.js — HTTP 客户端 + 路径构建器（从 apiRegistry SSOT 读取）
 * - scripts/lib/pluginTests.js — 5 个测试用例（装备/功法/编年史/世界域/联动）
 * - 本文件 — 启动入口 + 路径前置检查 + 结果汇总
 *
 * 使用：
 *   node scripts/testPluginsVerify.js
 *   TEST_PROJECT_ID=xxx TEST_PORT=3001 node scripts/testPluginsVerify.js
 */
const { CONFIG, P, req, log, updateProjectSettings } = require('./lib/apiClient');
const {
    testEquipment, testTechniques, testChronicle, testWorldScope, testCombined
} = require('./lib/pluginTests');

// 测试项目ID（可通过环境变量覆盖，否则使用默认测试项目）
const PID = process.env.TEST_PROJECT_ID || 'fee2bcd3-d73a-4ce9-8899-12b2e1350724';

// 本入口文件用到的所有路径键（启动前置检查会逐个验证）
const REQUIRED_PATH_KEYS = Object.freeze([
    'health.root',
    'projects.detail',
    'chapters.list', 'chapters.detail', 'chapters.create',
    'pipeline.full', 'pipeline.task',
    'pipeline.chronicle', 'pipeline.worldscope',
    'entityCenter.entities',
    'materials.list',
    'characterStates.states'
]);

const results = { equipment: null, techniques: null, chronicle: null, worldScope: null, combined: null };

/** 启动前置：验证所有路径键都能从 apiRegistry SSOT 解析（早失败早发现） */
function verifyPathKeys() {
    let ok = 0;
    for (const k of REQUIRED_PATH_KEYS) {
        try { P(k); ok++; } catch (e) {
            console.error(`❌ 路径键解析失败: ${k} — ${e.message}`);
            console.error('   apiRegistry.TEST_PATHS 与测试脚本不一致，请先同步 SSOT');
            return false;
        }
    }
    log(`✅ ${ok} 个路径键全部从 apiRegistry 解析成功`);
    return true;
}

/** 打印测试结果汇总 */
function printSummary() {
    console.log('\n========================================\n测试结果汇总\n========================================');
    console.log(`1. 装备(equipment): ${results.equipment?.pass ? '✅' : '❌'} - ${results.equipment?.note || ''}`);
    console.log(`2. 功法(techniques): ${results.techniques?.pass ? '✅' : '❌'} - ${results.techniques?.note || ''}`);
    console.log(`3. 编年史(chronicle): ${results.chronicle?.pass ? '✅' : '⚠️'} - count=${results.chronicle?.count || 0}`);
    console.log(`4. 世界域(worldScope): ${results.worldScope?.pass ? '✅' : '⚠️'} - count=${results.worldScope?.count || 0}`);
    console.log(`5. 联动(combined): ${results.combined?.pass ? '✅' : '⚠️'} - chronicle=${results.combined?.chronicleCount || 0}, worldScope=${results.combined?.worldScopeCount || 0}`);
    const passCount = [results.equipment, results.techniques, results.chronicle, results.worldScope, results.combined]
        .filter(r => r?.pass).length;
    console.log(`\n通过率: ${passCount}/5`);
    return passCount;
}

(async () => {
    console.log('========================================\n4个功能插件逐个+联动测试\n========================================');
    console.log(`测试项目ID: ${PID}`);
    console.log(`服务端口: ${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log(`超时: ${CONFIG.TIMEOUT_MS / 1000}s`);

    if (!verifyPathKeys()) process.exit(2);

    const h = await req('GET', P('health.root'), null, 5000);
    if (h.status !== 200) { console.log('❌ 服务器未运行'); process.exit(1); }
    log('✅ 服务器运行中');

    await updateProjectSettings(PID, { chronicleLevel: 'off', worldScopeLevel: 'off' });
    log('已重置所有模块为off');

    await testEquipment(PID, results);
    await testTechniques(PID, results);
    await testChronicle(PID, results);
    await testWorldScope(PID, results);
    await testCombined(PID, results);

    const passCount = printSummary();
    process.exit(passCount >= 4 ? 0 : 1);
})().catch(e => { console.error('异常:', e); process.exit(1); });
