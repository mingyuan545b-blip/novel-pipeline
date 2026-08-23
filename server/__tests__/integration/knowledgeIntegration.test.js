'use strict';

/**
 * 知识库集成测试 (MemoryPyramid + ForeshadowLedger + ConsistencyChecker + syncFactsFromMaterials)
 */

const store = require('../../store');
const { foreshadowLedger, memoryPyramid, consistencyChecker, syncFactsFromMaterials } = require('../../services/knowledgeBase');

const TEST_PROJECT_ID = `test-knowledge-${Date.now()}`;
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

async function testKnowledgeBase() {
    console.log('\n🧠 知识库测试');

    const fact1 = await memoryPyramid.addFact(TEST_PROJECT_ID, 'M0', 'worldview', '不可出现现代科技', { importance: 90 });
    await assertAsync(() => Promise.resolve(fact1 && fact1.level === 'M0'), '添加M0事实');
    const fact2 = await memoryPyramid.addFact(TEST_PROJECT_ID, 'M1', 'character-core', '苏婉清性格必须一致: 外冷内热', { importance: 75 });
    await assertAsync(() => Promise.resolve(fact2 && fact2.level === 'M1'), '添加M1事实');
    const fact3 = await memoryPyramid.addFact(TEST_PROJECT_ID, 'M2', 'plot', '第3章发现玉佩', { importance: 40 });
    await assertAsync(() => Promise.resolve(fact3 && fact3.level === 'M2'), '添加M2事实');
    const fact4 = await memoryPyramid.addFact(TEST_PROJECT_ID, 'M3', 'background', '苏家历史渊源', { importance: 15 });
    await assertAsync(() => Promise.resolve(fact4 && fact4.level === 'M3'), '添加M3事实');

    const factsCh5 = await memoryPyramid.getFactsForChapter(TEST_PROJECT_ID, 5);
    await assertAsync(() => Promise.resolve(factsCh5.length >= 4), 'getFactsForChapter返回>=4条');

    const factsForPrompt = await memoryPyramid.getFactsForPrompt(TEST_PROJECT_ID, 5, 500);
    await assertAsync(() => Promise.resolve(Array.isArray(factsForPrompt)), 'getFactsForPrompt返回数组');
    await assertAsync(() => Promise.resolve(factsForPrompt.every(f => f.factText)), '每条事实有factText');

    const decayResult = await memoryPyramid.runDecayCycle(TEST_PROJECT_ID, 20);
    await assertAsync(() => Promise.resolve(decayResult && typeof decayResult.demoted === 'number'), 'runDecayCycle执行');

    const promoted = await memoryPyramid.promoteFact(fact3.id, 'M1');
    await assertAsync(() => Promise.resolve(promoted && promoted.level === 'M1'), '事实升级M2→M1');

    const fs1 = await foreshadowLedger.plant(TEST_PROJECT_ID, '神秘玉佩', '苏婉清发现玉佩', { plantChapter: 3, importance: 'high', expectedResolveWindow: '10章内' });
    await assertAsync(() => Promise.resolve(fs1 && fs1.status === 'planted'), '种植伏笔');
    const fs1Advanced = await foreshadowLedger.advance(TEST_PROJECT_ID, '神秘玉佩', 7, '玉佩发出微光');
    await assertAsync(() => Promise.resolve(fs1Advanced && fs1Advanced.status === 'advanced'), '推进伏笔');
    const fs1Resolved = await foreshadowLedger.resolve(TEST_PROJECT_ID, '神秘玉佩', 12, '玉佩是上古传承');
    await assertAsync(() => Promise.resolve(fs1Resolved && fs1Resolved.status === 'resolved'), '回收伏笔');

    const fsStats = await foreshadowLedger.getStats(TEST_PROJECT_ID);
    await assertAsync(() => Promise.resolve(fsStats.total >= 1), '伏笔统计total>=1');
    await assertAsync(() => Promise.resolve(fsStats.resolved >= 1), '伏笔统计resolved>=1');

    const check1 = await consistencyChecker.recordCheck(TEST_PROJECT_ID, 5, 'name', '主角名字不一致', { severity: 'warning', entityId: 'test-entity-1', expectedValue: '苏婉清', actualValue: '苏婉卿' });
    await assertAsync(() => Promise.resolve(check1 && check1.checkType === 'name'), '记录一致性问题');
    const unresolved = await consistencyChecker.getUnresolved(TEST_PROJECT_ID);
    await assertAsync(() => Promise.resolve(unresolved.length >= 1), '获取未解决问题>=1');
    await consistencyChecker.resolveCheck(check1.id, 6);
    const unresolvedAfter = await consistencyChecker.getUnresolved(TEST_PROJECT_ID);
    await assertAsync(() => Promise.resolve(unresolvedAfter.length === 0), '解决后未解决数=0');
}

async function testFactSync() {
    console.log('\n🔄 素材→知识库同步测试');

    const testMats = [
        { type: 'worldview', name: '修仙世界设定', content: '本世界不可出现现代科技。严禁穿越者带入手机等电子设备。' },
        { type: 'character', name: '苏婉清', content: '性格：外冷内热，对亲近之人温柔似水。核心特质：坚韧不拔。' }
    ];
    for (let i = 0; i < testMats.length; i++) {
        const m = testMats[i];
        await store.setItem('materials', `mat-sync-${Date.now()}-${i}`, {
            id: `mat-sync-${Date.now()}-${i}`, projectId: TEST_PROJECT_ID, type: m.type, name: m.name,
            initialContent: m.content, currentContent: m.content, tags: ['核心'], archived: false, createdAt: new Date().toISOString()
        });
    }

    const materials = await store.queryItems('materials', { projectId: TEST_PROJECT_ID });
    const synced = await syncFactsFromMaterials(TEST_PROJECT_ID, materials);
    await assertAsync(() => Promise.resolve(typeof synced === 'number'), `syncFactsFromMaterials返回数字(synced=${synced})`);

    const facts = await memoryPyramid.getFactsForChapter(TEST_PROJECT_ID, 1);
    await assertAsync(() => Promise.resolve(facts.filter(f => f.category === 'worldview').length >= 1), '世界观禁止规则被提取');
    await assertAsync(() => Promise.resolve(facts.filter(f => f.category === 'character-core').length >= 1), '角色核心特质被提取');
}

async function cleanup() {
    console.log('\n🧹 清理测试数据...');
    const types = ['knowledge-facts', 'foreshadow-ledger', 'consistency-checks', 'materials'];
    for (const type of types) {
        try { const items = await store.queryItems(type, { projectId: TEST_PROJECT_ID }); for (const item of items) await store.deleteItem(type, item.id); } catch (_) {}
    }
    try { const p = await store.getItem('projects', TEST_PROJECT_ID); if (p) await store.deleteItem('projects', TEST_PROJECT_ID); } catch (_) {}
    console.log('  清理完成');
}

async function main() {
    console.log('========================================');
    console.log('  知识库 集成测试');
    console.log('========================================');
    console.log(`测试项目ID: ${TEST_PROJECT_ID}`);

    await store.setItem('projects', TEST_PROJECT_ID, {
        id: TEST_PROJECT_ID, name: '集成测试项目-甜宠修仙', genre: GENRE_ID, mode: 'tomato-short',
        targetChapters: 25, currentChapter: 5, status: 'active', genreId: GENRE_ID,
        styleProfile: { genreId: GENRE_ID }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    try { await testKnowledgeBase(); await testFactSync(); }
    catch (err) { console.error('\n💥 测试执行异常:', err.message); }
    finally { await cleanup(); }

    console.log('\n========================================');
    console.log(`  测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
    console.log('========================================');
    if (errors.length > 0) { console.log('\n失败项:'); errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`)); }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
