const store = require('../store');
const { getAgentPrompt, deduplicateSystemPrompt } = require('../services/agentPrompts');
const { detectGenre: detectGenreFromConfig } = require('../services/genreConfig');
const { runAllConflictChecks } = require('./verifyConflictChecks');

async function verify() {
    console.log('🔍 开始全面系统验证...\n');

    const profiles = await store.listItems('style-profiles');
    const sp = profiles.find(p => p.key === 'urban-sweetpet-designer-tattoo');
    if (!sp) { console.log('❌ StyleProfile不存在'); process.exit(1); }
    console.log(`✅ Step 1: StyleProfile存在 (${sp.key})`);

    const projectId = 'verify-full-project';
    await store.setItem('projects', projectId, { id: projectId, name: '破笼之鸟', genre: '都市甜宠', styleProfile: 'urban-sweetpet-designer-tattoo', wordConfig: { rejectMin: 2000, targetMin: 2200, targetMax: 2800, maxWords: 3000 }, targetChapters: 20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    console.log('✅ Step 2: 测试项目已创建');

    try { const genre = detectGenreFromConfig(sp); console.log(`✅ Step 3: Genre=${genre?.id || '未检测到'}`); } catch (e) { console.log(`❌ Step 3: ${e.message}`); }

    const agentTypes = ['writer', 'first-review', 'second-review', 'reviser', 'final-editor', 'polisher'];
    const prompts = {};
    for (const t of agentTypes) { try { const p = await getAgentPrompt(t, 'novel', projectId); if (p?.system) prompts[t] = p.system; console.log(`✅ ${t} Prompt (${p?.system?.length || 0}字符)`); } catch (e) { console.log(`❌ ${t}: ${e.message}`); } }

    console.log('\n🔍 Step 5: 提示词冲突检查...');
    const conflicts = runAllConflictChecks(prompts);
    if (conflicts.length === 0) console.log('✅ 未发现冲突');
    else { for (const c of conflicts) { const icon = c.severity === 'high' ? '🔴' : '🟡'; console.log(`${icon} [${c.agent}] ${c.type}: ${c.desc}`); } }

    console.log('\n🔍 Step 6: 模块加载检查...');
    for (const [name, p] of [['store','../store'],['agentPrompts','../services/agentPrompts'],['genreConfig','../services/genreConfig']]) { try { require(p); console.log(`✅ ${name}`); } catch (e) { console.log(`❌ ${name}: ${e.message}`); } }

    if (prompts['writer']) {
        const wp = prompts['writer'];
        console.log('\n🔍 Step 7: Writer Prompt检查');
        console.log(`   内容长度>100: ${wp.length > 100 ? '✅' : '❌'} (${wp.length}字符)`);
        console.log(`   无未替换占位符: ${!wp.includes('[Agent类型]') ? '✅' : '❌'}`);
        console.log(`   包含风格配置: ${wp.includes('本作风格配置') ? '✅' : '❌'}`);
        console.log(`   包含字数限制: ${wp.includes('2000') || wp.includes('min') ? '✅' : '❌'}`);
    }

    console.log('\n═══════════════════════════════════════');
    const high = conflicts.filter(c => c.severity === 'high');
    const medium = conflicts.filter(c => c.severity === 'medium');
    if (high.length === 0) console.log('✅ 无高风险问题');
    else { console.log(`🔴 ${high.length}个高风险:`); high.forEach(c => console.log(`   - [${c.agent}] ${c.type}`)); }
    if (medium.length > 0) { console.log(`🟡 ${medium.length}个中风险`); }
    console.log('🎉 验证完成！');
}

verify().catch(err => { console.error('❌ 验证失败:', err); process.exit(1); });
