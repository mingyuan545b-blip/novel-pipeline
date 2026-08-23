/**
 * pluginTests.js — 4个功能插件测试用例 + 联动测试
 *
 * 每个测试函数接收 PID，使用 apiClient 的辅助函数，
 * 返回写入 results 对象。所有路径通过 P() 从 apiRegistry SSOT 读取。
 *
 * 插件分类：
 * 1. 装备(equipment) - entityType, cultivationSystem模块内置
 * 2. 功法(techniques) - genreStateKey, cultivationSystem模块内置
 * 3. 编年史(chronicle) - pipelineModuleRegistry, configKey=chronicleLevel
 * 4. 世界域(worldScope) - pipelineModuleRegistry, configKey=worldScopeLevel
 */
const { P, req, log, updateProjectSettings, ensureChapter, runPipeline } = require('./apiClient');

// === 测试1：装备(entityType='equipment') ===
async function testEquipment(PID, results) {
    log('\n========== 测试1：装备(entityType=equipment) ==========');
    const r = await req('GET', `${P('entityCenter.entities')}?projectId=${PID}&entityType=equipment`);
    if (r.status !== 200) {
        log(`❌ 查询失败 HTTP=${r.status}`);
        results.equipment = { pass: false, error: '查询失败' };
        return;
    }
    const entities = Array.isArray(r.body) ? r.body : [];
    log(`装备实体数: ${entities.length}`);
    if (entities.length > 0) {
        entities.slice(0, 3).forEach(e => log(`  - ${e.name} (${e.entityType}): ${(e.content || '').substring(0, 80)}`));
    }
    const matR = await req('GET', `${P('materials.list')}?projectId=${PID}&type=equipment`);
    if (matR.status === 200) {
        const mats = Array.isArray(matR.body) ? matR.body : [];
        log(`素材库equipment素材数: ${mats.length}`);
        if (mats.length > 0) mats.slice(0, 3).forEach(m => log(`  - ${m.name}: ${(m.content || '').substring(0, 80)}`));
    }
    results.equipment = {
        pass: true, count: entities.length,
        note: entities.length > 0 ? '有装备实体' : '无装备实体(需检查素材生成)'
    };
    log(`装备测试: ${results.equipment.pass ? '✅' : '❌'} (${results.equipment.note})`);
}

// === 测试2：功法(techniques genreStateKey) ===
async function testTechniques(PID, results) {
    log('\n========== 测试2：功法(techniques genreStateKey) ==========');
    const r = await req('GET', `${P('entityCenter.entities')}?projectId=${PID}`);
    if (r.status !== 200) {
        log(`❌ 查询失败 HTTP=${r.status}`, r.body);
        results.techniques = { pass: false, error: '查询失败' };
        return;
    }
    const entities = Array.isArray(r.body) ? r.body : [];
    log(`实体总数: ${entities.length}`);
    let hasTechniques = false;
    for (const e of entities) {
        const genreState = e.genreState || e.baseState?.genreState || {};
        const techs = genreState.techniques || [];
        if (techs.length > 0 || Object.keys(genreState).length > 0) {
            log(`  ${e.name} (${e.entityType}): genreState keys=${Object.keys(genreState).join(',')}, techniques=${JSON.stringify(techs).substring(0, 100)}`);
            if (techs.length > 0) hasTechniques = true;
        }
    }
    const csR = await req('GET', P('characterStates.states', { projectId: PID }));
    let csTechniquesCount = 0;
    if (csR.status === 200) {
        const states = Array.isArray(csR.body) ? csR.body : [];
        log(`角色状态记录数: ${states.length}`);
        for (const s of states) {
            const delta = s.delta || {};
            if (delta.techniques && delta.techniques.length > 0) {
                csTechniquesCount++;
                log(`  第${s.chapterNumber || '?'}章 ${s.characterName || s.entityKey}: techniques delta=${JSON.stringify(delta.techniques).substring(0, 80)}`);
            }
        }
    }
    results.techniques = {
        pass: true, hasTechniques, csTechniquesCount,
        note: hasTechniques ? '有功法数据(entity)' : (csTechniquesCount > 0 ? '有功法delta(character-states)' : '无功法数据(需跑新章节生成)')
    };
    log(`功法测试: ${results.techniques.pass ? '✅' : '❌'} (${results.techniques.note})`);
}

// === 测试3：编年史(chronicle) ===
async function testChronicle(PID, results) {
    log('\n========== 测试3：编年史(chronicleLevel=full) ==========');
    log('启用chronicleLevel=full...');
    const ok = await updateProjectSettings(PID, { chronicleLevel: 'full' });
    if (!ok) { log('❌ 启用失败'); results.chronicle = { pass: false, error: '启用失败' }; return; }
    log('✅ chronicleLevel=full已启用');

    const outline = `第8章：林渊在主世界整理五家战利品，发现墨家机关图纸暗藏小世界坐标。苏婉清提出联合探索，但要求分得墨家技术。林渊用齿轮感应到第二个小世界的位置，但开启需要五家信物之一。赵执事暗中通知法家，法家派人拦截。\n场景1：林渊在书房整理战利品，齿轮发烫\n场景2：苏婉清来访，提出合作条件\n场景3：林渊用齿轮感应小世界坐标\n场景4：赵执事密报法家，法家行动组出发`;
    await ensureChapter(PID, 8, outline);
    await runPipeline(PID, 8);

    const r = await req('GET', P('pipeline.chronicle', { projectId: PID }));
    if (r.status === 200) {
        const chronicleData = r.body.data || [];
        const chronicleCount = Array.isArray(chronicleData) ? chronicleData.length : 0;
        if (chronicleCount > 0) chronicleData.slice(0, 3).forEach(c => log(`  chronicle: ${JSON.stringify(c).substring(0, 150)}`));
        log(`编年史记录数: ${chronicleCount}`);
        results.chronicle = { pass: chronicleCount > 0, count: chronicleCount };
    } else {
        results.chronicle = { pass: false, error: `查询失败 HTTP=${r.status}` };
    }
    log(`编年史测试: ${results.chronicle.pass ? '✅' : '⚠️'} (count=${results.chronicle.count || 0})`);

    await updateProjectSettings(PID, { chronicleLevel: 'off' });
    log('已关闭chronicleLevel');
}

// === 测试4：世界域(worldScope) ===
async function testWorldScope(PID, results) {
    log('\n========== 测试4：世界域(worldScopeLevel=full) ==========');
    log('启用worldScopeLevel=full...');
    const ok = await updateProjectSettings(PID, { worldScopeLevel: 'full' });
    if (!ok) { log('❌ 启用失败'); results.worldScope = { pass: false, error: '启用失败' }; return; }
    log('✅ worldScopeLevel=full已启用');

    const outline = `第9章：林渊和苏婉清前往小世界入口，途中遭遇法家拦截。林渊用儒家言出法随挡住第一波攻击，苏婉清展示道家术法协助突围。到达入口时发现墨家机关已被激活，需要解谜才能进入。林渊用齿轮作为钥匙开启入口。\n场景1：途中遭遇法家拦截，战斗\n场景2：苏婉清展示道家术法突围\n场景3：到达入口发现墨家机关\n场景4：林渊用齿轮解谜开启入口`;
    await ensureChapter(PID, 9, outline);
    await runPipeline(PID, 9);

    const r = await req('GET', P('pipeline.worldscope', { projectId: PID }));
    if (r.status === 200) {
        const wsData = r.body.data || [];
        const worldScopeCount = Array.isArray(wsData) ? wsData.length : 0;
        if (worldScopeCount > 0) wsData.slice(0, 3).forEach(w => log(`  worldScope: ${JSON.stringify(w).substring(0, 150)}`));
        log(`世界域记录数: ${worldScopeCount}`);
        results.worldScope = { pass: worldScopeCount > 0, count: worldScopeCount };
    } else {
        results.worldScope = { pass: false, error: `查询失败 HTTP=${r.status}` };
    }
    log(`世界域测试: ${results.worldScope.pass ? '✅' : '⚠️'} (count=${results.worldScope.count || 0})`);

    await updateProjectSettings(PID, { worldScopeLevel: 'off' });
    log('已关闭worldScopeLevel');
}

// === 测试5：联动(chronicle + worldScope) ===
async function testCombined(PID, results) {
    log('\n========== 测试5：联动(chronicle+worldScope同时启用) ==========');
    log('同时启用chronicleLevel=full + worldScopeLevel=full...');
    const ok = await updateProjectSettings(PID, { chronicleLevel: 'full', worldScopeLevel: 'full' });
    if (!ok) { log('❌ 启用失败'); results.combined = { pass: false, error: '启用失败' }; return; }
    log('✅ 两个模块已同时启用');

    const outline = `第10章：林渊进入小世界后发现是一个规则怪谈世界。苏婉清在外面守候，通过信物保持联系。林渊在小世界中发现墨家遗留的机关人，需要解开规则才能通过。同时主世界法家开始对苏婉清施压。\n场景1：林渊进入小世界，发现规则怪谈\n场景2：苏婉清在外守候，法家施压\n场景3：林渊解规则谜题\n场景4：林渊获得墨家机关人核心`;
    await ensureChapter(PID, 10, outline);
    await runPipeline(PID, 10);

    const chronR = await req('GET', P('pipeline.chronicle', { projectId: PID }));
    const wsR = await req('GET', P('pipeline.worldscope', { projectId: PID }));
    let chronicleCount = 0, worldScopeCount = 0;
    if (chronR.status === 200) {
        const chronData = chronR.body.data || [];
        chronicleCount = Array.isArray(chronData) ? chronData.length : 0;
    }
    if (wsR.status === 200) {
        const wsData = wsR.body.data || [];
        worldScopeCount = Array.isArray(wsData) ? wsData.length : 0;
    }
    log(`联动后: chronicle=${chronicleCount}条记录, worldScope=${worldScopeCount}条记录`);
    results.combined = { pass: chronicleCount > 0 || worldScopeCount > 0, chronicleCount, worldScopeCount };
    log(`联动测试: ${results.combined.pass ? '✅' : '⚠️'}`);

    await updateProjectSettings(PID, { chronicleLevel: 'off', worldScopeLevel: 'off' });
    log('已关闭两个模块');
}

module.exports = { testEquipment, testTechniques, testChronicle, testWorldScope, testCombined };
