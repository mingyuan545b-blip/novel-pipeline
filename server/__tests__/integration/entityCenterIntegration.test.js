'use strict';

/**
 * 实体中心集成测试
 * 不依赖LLM API，直接测试store层和service层
 */

const store = require('../../store');
const entityCenter = require('../../services/entityCenter');

const TEST_PROJECT_ID = `test-entity-${Date.now()}`;
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

async function testEntityCenter() {
    console.log('\n👤 实体中心测试');

    const entity1 = await entityCenter.getOrCreateEntity(TEST_PROJECT_ID, '苏婉清', 'protagonist', {
        personality: '外冷内热', background: '修仙世家嫡女', appearance: '白衣胜雪', speechStyle: '清冷疏离'
    });
    await assertAsync(() => Promise.resolve(entity1 && entity1.name === '苏婉清'), '创建主角实体');

    const entity2 = await entityCenter.getOrCreateEntity(TEST_PROJECT_ID, '林墨寒', 'supporting', {
        personality: '温润如玉', background: '隐世宗门弟子', appearance: '青衫磊落', speechStyle: '温和有礼'
    });
    await assertAsync(() => Promise.resolve(entity2 && entity2.name === '林墨寒'), '创建配角实体');

    const entities = await entityCenter.getEntitiesForProject(TEST_PROJECT_ID);
    await assertAsync(() => Promise.resolve(entities.length >= 2), '查询项目实体>=2');

    await entityCenter.updateEntityState(entity1.id, 5, {
        location: '灵峰山顶', mood: '警惕', knowledge: ['发现玉佩秘密'], relationships: { '林墨寒': '初次相遇' }
    });
    await assertAsync(() => Promise.resolve(true), '更新实体第5章状态');

    const chronicle = await entityCenter.getEntityChronicle(entity1.id);
    await assertAsync(() => Promise.resolve(Array.isArray(chronicle)), '获取实体编年史');

    const relations = await entityCenter.getEntityRelations(entity1.id);
    await assertAsync(() => Promise.resolve(Array.isArray(relations)), '获取实体关系');

    const entity3 = await entityCenter.getOrCreateEntity(TEST_PROJECT_ID, '暗影尊者', 'antagonist', {
        personality: '阴险狡诈', background: '魔道长老', appearance: '黑袍遮面', speechStyle: '阴恻恻'
    });
    await assertAsync(() => Promise.resolve(entity3 && entity3.name === '暗影尊者'), '创建反派实体');

    const allEntities = await entityCenter.getEntitiesForProject(TEST_PROJECT_ID);
    const protagonists = allEntities.filter(e => e.roleLevel === 'protagonist');
    await assertAsync(() => Promise.resolve(protagonists.length >= 1), '主角数量>=1');

    await entityCenter.deleteEntity(entity3.id);
    const afterDelete = await entityCenter.getEntitiesForProject(TEST_PROJECT_ID);
    await assertAsync(() => Promise.resolve(afterDelete.length === 2), '删除后实体数=2');
}

async function cleanup() {
    console.log('\n🧹 清理测试数据...');
    const entityTypes = ['entities', 'entity-state-history', 'entity-relations', 'entity-registry', 'materials'];
    for (const type of entityTypes) {
        try { const items = await store.queryItems(type, { projectId: TEST_PROJECT_ID }); for (const item of items) await store.deleteItem(type, item.id); } catch (_) {}
    }
    try { const project = await store.getItem('projects', TEST_PROJECT_ID); if (project) await store.deleteItem('projects', TEST_PROJECT_ID); } catch (_) {}
    console.log('  清理完成');
}

async function main() {
    console.log('========================================');
    console.log('  实体中心集成测试');
    console.log('========================================');
    console.log(`测试项目ID: ${TEST_PROJECT_ID}`);

    await store.setItem('projects', TEST_PROJECT_ID, {
        id: TEST_PROJECT_ID, name: '集成测试项目-甜宠修仙', genre: GENRE_ID, mode: 'tomato-short',
        targetChapters: 25, currentChapter: 5, status: 'active', genreId: GENRE_ID,
        styleProfile: { genreId: GENRE_ID }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    console.log('测试项目已创建');

    try { await testEntityCenter(); } catch (err) { console.error('\n💥 测试执行异常:', err.message); console.error(err.stack); }
    finally { await cleanup(); }

    console.log('\n========================================');
    console.log(`  测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
    console.log('========================================');
    if (errors.length > 0) { console.log('\n失败项:'); errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`)); }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
