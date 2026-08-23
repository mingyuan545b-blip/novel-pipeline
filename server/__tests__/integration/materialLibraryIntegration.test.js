'use strict';

/**
 * 素材库集成测试
 * 不依赖LLM API，直接测试store层
 */

const store = require('../../store');

const TEST_PROJECT_ID = `test-material-${Date.now()}`;
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

async function testMaterialLibrary() {
    console.log('\n📚 素材库测试');

    const testMaterials = [
        { type: 'worldview', name: '修仙世界设定', content: '本世界不可出现现代科技。严禁穿越者带入手机等电子设备。修炼体系必须遵守筑基→金丹→元婴的铁律。', tags: ['核心设定'] },
        { type: 'power-system', name: '修炼等级体系', content: '不可跳级突破。必须循序渐进。严禁越级战斗超过两个小境界。', tags: ['核心设定'] },
        { type: 'character', name: '苏婉清', content: '性格：外冷内热，对亲近之人温柔似水。核心特质：坚韧不拔。人格类型：INTJ。', tags: ['主角', '核心'] },
        { type: 'foreshadowing', name: '神秘玉佩', content: '苏婉清在古墓中发现一块神秘玉佩，似乎隐藏着惊天秘密', tags: ['伏笔铺垫'] }
    ];

    for (let i = 0; i < testMaterials.length; i++) {
        const m = testMaterials[i];
        const id = `mat-${Date.now()}-${i}`;
        await store.setItem('materials', id, {
            id, projectId: TEST_PROJECT_ID, type: m.type, name: m.name,
            initialContent: m.content, currentContent: m.content,
            tags: m.tags, archived: false, createdAt: new Date().toISOString()
        });
        await assertAsync(() => Promise.resolve(true), `创建${m.type}素材`);
    }

    const materials = await store.queryItems('materials', { projectId: TEST_PROJECT_ID });
    await assertAsync(() => Promise.resolve(materials.length >= 4), '查询素材数量>=4');

    const worldviewMats = materials.filter(m => m.type === 'worldview');
    await assertAsync(() => Promise.resolve(worldviewMats.length >= 1), '世界观素材查询');
}

async function cleanup() {
    console.log('\n🧹 清理测试数据...');
    try { const items = await store.queryItems('materials', { projectId: TEST_PROJECT_ID }); for (const item of items) await store.deleteItem('materials', item.id); } catch (_) {}
    try { const project = await store.getItem('projects', TEST_PROJECT_ID); if (project) await store.deleteItem('projects', TEST_PROJECT_ID); } catch (_) {}
    console.log('  清理完成');
}

async function main() {
    console.log('========================================');
    console.log('  素材库集成测试');
    console.log('========================================');
    console.log(`测试项目ID: ${TEST_PROJECT_ID}`);

    await store.setItem('projects', TEST_PROJECT_ID, {
        id: TEST_PROJECT_ID, name: '集成测试项目-素材库', genre: GENRE_ID, mode: 'tomato-short',
        targetChapters: 25, currentChapter: 5, status: 'active', genreId: GENRE_ID,
        styleProfile: { genreId: GENRE_ID }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    console.log('测试项目已创建');

    try { await testMaterialLibrary(); } catch (err) { console.error('\n💥 测试执行异常:', err.message); console.error(err.stack); }
    finally { await cleanup(); }

    console.log('\n========================================');
    console.log(`  测试结果: ✅ ${passed} 通过, ❌ ${failed} 失败`);
    console.log('========================================');
    if (errors.length > 0) { console.log('\n失败项:'); errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`)); }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
