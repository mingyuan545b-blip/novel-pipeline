/**
 * verify-intent-depth.js — 验证意图规划→素材深度映射
 * 测试意图中提及的角色是否获得L3深度提升
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
process.env.USE_PG = 'true';
const store = require('../store');
const { resolveIntentDepth, applyIntentDepthOverride, extractCharacterNamesFromIntent, resolveEntityIntentDepth } = require('../services/pipeline/intentDepthResolver');
const { resolveContext } = require('../services/pipeline/contextCommander');
const { assembleMaterialState } = require('../services/pipeline/materialStateAssembler');
const { resolveGenreFromProject } = require('../services/genreConfig');

async function main() {
    const projects = await store.queryItems('projects', {});
    if (projects.length === 0) { console.log('ERROR: No projects found'); process.exit(1); }
    const project = projects[0];
    const projectId = project.id;
    console.log(`\n=== 验证意图深度映射: ${project.title || project.name} ===\n`);

    // 1. 测试extractCharacterNamesFromIntent
    console.log('--- 1. 角色名提取测试 ---');
    const mockIntent = {
        goal: '温以宁发现薄寒手抖的秘密',
        mustKeep: ['温以宁的医学专业判断力', '薄寒对外冷硬对内温柔的反差'],
        mustAvoid: ['禁止温以宁当场揭穿薄寒的手抖'],
        conflictDesign: '温以宁注意到薄寒手抖→内心挣扎要不要问→选择沉默守护',
        hookAdvance: ['薄寒手抖秘密'],
        hookResolve: [],
    };
    const knownNames = ['温以宁', '薄寒', '陆衍', '苏念'];
    const extractedNames = extractCharacterNamesFromIntent(mockIntent, knownNames);
    console.log(`已知角色: [${knownNames.join(', ')}]`);
    console.log(`意图提及: [${[...extractedNames].join(', ')}]`);
    console.log(`预期: 温以宁, 薄寒 → ${extractedNames.has('温以宁') && extractedNames.has('薄寒') ? '✅ 通过' : '❌ 失败'}`);
    console.log(`未提及: 陆衍, 苏念 → ${!extractedNames.has('陆衍') && !extractedNames.has('苏念') ? '✅ 通过' : '❌ 失败'}`);

    // 2. 测试resolveIntentDepth
    console.log('\n--- 2. 意图深度解析测试 ---');
    const materials = await store.queryItems('materials', { projectId });
    const charNames = materials.filter(m => m.type === 'character').map(m => m.name);
    console.log(`DB角色名: [${charNames.join(', ')}]`);

    // 获取第1章的意图
    const intentResult = await resolveIntentDepth(projectId, 1, charNames);
    console.log(`意图角色名: [${[...(intentResult.characterNames || [])].join(', ')}]`);
    console.log(`关系冲突: ${intentResult.hasRelConflict ? '是' : '否'}`);
    console.log(`世界观提及: ${intentResult.hasWorldMention ? '是' : '否'}`);
    console.log(`伏笔名: [${[...(intentResult.foreshadowingNames || [])].join(', ')}]`);
    console.log(`深度覆盖: ${JSON.stringify(intentResult.depthOverrides)}`);

    // 3. 测试applyIntentDepthOverride
    console.log('\n--- 3. 深度覆盖应用测试 ---');
    const testNeed = { type: 'character', detail: 'brief', resolvedDepth: 'L1' };
    const overridden = applyIntentDepthOverride({ ...testNeed }, intentResult);
    console.log(`character need: L1 → ${overridden.resolvedDepth} ${overridden.intentDepthOverride ? '(意图提升)' : '(无变化)'}`);

    const testNeed2 = { type: 'foreshadowing', detail: 'brief', resolvedDepth: 'L1' };
    const overridden2 = applyIntentDepthOverride({ ...testNeed2 }, intentResult);
    console.log(`foreshadowing need: L1 → ${overridden2.resolvedDepth} ${overridden2.intentDepthOverride ? '(意图提升)' : '(无变化)'}`);

    const testNeed3 = { type: 'worldview', detail: 'brief', resolvedDepth: 'L1' };
    const overridden3 = applyIntentDepthOverride({ ...testNeed3 }, intentResult);
    console.log(`worldview need: L1 → ${overridden3.resolvedDepth} ${overridden3.intentDepthOverride ? '(意图提升)' : '(无变化)'}`);

    // 4. 测试resolveEntityIntentDepth
    console.log('\n--- 4. 实体意图深度测试 ---');
    const activeMats = materials.filter(m => !m.archived);
    const charMats = activeMats.filter(m => m.type === 'character');
    for (const char of charMats.slice(0, 5)) {
        const intentDepth = resolveEntityIntentDepth(char, intentResult);
        console.log(`  ${char.name}: 意图深度=${intentDepth || '无提升'} ${intentResult.characterNames?.has(char.name) ? '(意图提及)' : ''}`);
    }

    // 5. 端到端测试：scheduleMaterials是否传递了意图深度
    console.log('\n--- 5. 端到端测试：writer素材深度 ---');
    const genre = resolveGenreFromProject(project);
    const chapter = { chapterNumber: 1, outline: '温以宁和薄寒第一次相遇', scene: '主世界' };
    const scheduled = await assembleMaterialState('writer', {
        projectId, chapter, materials: activeMats, ctx: {}, project, genre
    });
    const charItems = scheduled.materials.character || [];
    for (const ci of charItems) {
        const inIntent = intentResult.characterNames?.has(ci.name);
        console.log(`  ${ci.name}: depth=${ci.depth} ${inIntent ? '(意图提及→应为L3)' : ''}`);
    }

    console.log('\n=== 验证完成 ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
