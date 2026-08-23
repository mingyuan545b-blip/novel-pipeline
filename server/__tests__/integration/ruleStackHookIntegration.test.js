'use strict';

/**
 * 规则栈 + 伏笔预算 + 占位符架构 集成测试
 */

const store = require('../../store');
const { getRuleStackForProject } = require('../../services/ruleStack');
const { getHookBudgetForProject } = require('../../services/hookBudget');

const TEST_PROJECT_ID = `test-rules-hooks-${Date.now()}`;
const GENRE_ID = 'tomato-sweet';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
    if (condition) { passed++; console.log(`  ✅ ${message}`); }
    else { failed++; errors.push(message); console.log(`  ❌ ${message}`); }
}

async function assertAsync(fn, message) {
    try { const result = await fn(); assert(result, message); }
    catch (err) { assert(false, `${message} (异常: ${err.message})`); }
}

async function testRuleStack() {
    console.log('\n📐 规则栈测试');

    const ruleStack = getRuleStackForProject(TEST_PROJECT_ID);

    const imported = await ruleStack.extractRulesFromMaterials();
    await assertAsync(() => Promise.resolve(typeof imported === 'number'), `extractRulesFromMaterials返回数字(imported=${imported})`);

    const effectiveRules = await ruleStack.getEffectiveRules('writer');
    await assertAsync(() => Promise.resolve(Array.isArray(effectiveRules)), 'getEffectiveRules返回数组');

    const formatted = await ruleStack.formatRuleStackForPrompt('writer');
    await assertAsync(() => Promise.resolve(typeof formatted === 'string'), 'formatRuleStackForPrompt返回字符串');

    const summary = await ruleStack.getStackSummary();
    await assertAsync(() => Promise.resolve(summary && typeof summary.total === 'number'), 'getStackSummary返回摘要');
}

async function testHookBudget() {
    console.log('\n🪝 伏笔预算测试');

    const hookBudget = getHookBudgetForProject(TEST_PROJECT_ID);

    const syncResult = await hookBudget.syncFromForeshadowingMaterials();
    await assertAsync(() => Promise.resolve(typeof syncResult === 'number'), `syncFromForeshadowingMaterials返回数字(synced=${syncResult})`);

    const budget = await hookBudget.getBudgetStatus(5);
    await assertAsync(() => Promise.resolve(budget && typeof budget.activeCount === 'number'), 'getBudgetStatus返回状态');

    const agenda = await hookBudget.generateHookAgenda(5);
    await assertAsync(() => Promise.resolve(agenda !== null), 'generateHookAgenda返回数据');

    const hookSummary = await hookBudget.getHooksSummary();
    await assertAsync(() => Promise.resolve(hookSummary && typeof hookSummary.total === 'number'), 'getHooksSummary返回摘要');
}

async function testSlotArchitecture() {
    console.log('\n🏗️ 占位符架构测试');

    const { assembleAgentPrompt } = require('../../services/prompts/agentPromptAssembler');

    try {
        const writerResult = await assembleAgentPrompt('writer', 'tomato-short', TEST_PROJECT_ID);
        await assertAsync(() => Promise.resolve(writerResult && writerResult.system), 'writer组装返回system');
        await assertAsync(() => Promise.resolve(writerResult.buildLog && writerResult.buildLog.length > 0), 'writer组装有buildLog');
    } catch (err) {
        await assertAsync(() => Promise.resolve(false), `writer组装失败: ${err.message}`);
    }

    try {
        const reviewResult = await assembleAgentPrompt('first-review', 'tomato-short', TEST_PROJECT_ID);
        await assertAsync(() => Promise.resolve(reviewResult && reviewResult.system), 'first-review组装返回system');
    } catch (err) {
        await assertAsync(() => Promise.resolve(false), `first-review组装失败: ${err.message}`);
    }

    try {
        const { resolveMemoryPyramid } = require('../../services/prompts/slotResolvers');
        const pyramidData = await resolveMemoryPyramid({ projectId: TEST_PROJECT_ID, chapterNumber: 5 });
        if (pyramidData) {
            await assertAsync(() => Promise.resolve(pyramidData.includes('永不衰减') || pyramidData.includes('核心记忆') || pyramidData.includes('M0') || pyramidData.includes('M1')), 'memory-pyramid Slot返回含层级标签');
        } else {
            await assertAsync(() => Promise.resolve(true), 'memory-pyramid Slot返回null(无数据时合法)');
        }
    } catch (err) {
        await assertAsync(() => Promise.resolve(false), `memory-pyramid Slot失败: ${err.message}`);
    }
}

async function cleanup() {
    console.log('\n🧹 清理测试数据...');
    const types = ['rule-stack', 'hook-budget', 'materials'];
    for (const type of types) {
        try { const items = await store.queryItems(type, { projectId: TEST_PROJECT_ID }); for (const item of items) await store.deleteItem(type, item.id); } catch (_) {}
    }
    try { const p = await store.getItem('projects', TEST_PROJECT_ID); if (p) await store.deleteItem('projects', TEST_PROJECT_ID); } catch (_) {}
    console.log('  清理完成');
}

async function main() {
    console.log('========================================');
    console.log('  规则栈 + 伏笔预算 + 占位符 集成测试');
    console.log('========================================');
    console.log(`测试项目ID: ${TEST_PROJECT_ID}`);

    await store.setItem('projects', TEST_PROJECT_ID, {
        id: TEST_PROJECT_ID, name: '集成测试项目-甜宠修仙', genre: GENRE_ID, mode: 'tomato-short',
        targetChapters: 25, currentChapter: 5, status: 'active', genreId: GENRE_ID,
        styleProfile: { genreId: GENRE_ID }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    try { await testRuleStack(); await testHookBudget(); await testSlotArchitecture(); }
    catch (err) { console.error('\n💥 测试执行异常:', err.message); }
    finally { await cleanup(); }

    console.log('\n========================================');
    console.log(`  测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
    console.log('========================================');
    if (errors.length > 0) { console.log('\n失败项:'); errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`)); }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
