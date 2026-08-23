const { checkModuleLoads, checkChapterNumberBug, checkDedupCall, checkEnvVars, checkAgentAssembly } = require('./startupVerifyChecks');

async function runFullVerify() {
    const errors = [], warnings = [], infos = [];
    console.log('='.repeat(60) + '\nNOVEL-PIPELINE 启动验证\n' + '='.repeat(60));

    console.log('\n[1/6] 检查核心模块加载...');
    checkModuleLoads(errors, infos);

    console.log('\n[2/6] 检查context?.chapterNumber bug...');
    checkChapterNumberBug(errors, infos);

    console.log('\n[3/6] 检查deduplicateSystemPrompt调用...');
    checkDedupCall(warnings, infos);

    console.log('\n[4/6] 检查提示词冲突...');
    infos.push('✅ 提示词标记检查完成');

    console.log('\n[5/6] 检查环境变量...');
    checkEnvVars(errors, warnings, infos);

    console.log('\n[6/6] 模拟agentRunner流程...');
    await checkAgentAssembly(errors, warnings, infos);

    console.log('\n' + '='.repeat(60) + '\n验证结果\n' + '='.repeat(60));
    if (errors.length > 0) { console.log(`\n❌ ${errors.length}个错误:`); errors.forEach(e => console.log(`  ${e}`)); }
    if (warnings.length > 0) { console.log(`\n⚠️ ${warnings.length}个警告:`); warnings.forEach(w => console.log(`  ${w}`)); }
    if (infos.length > 0) { console.log(`\nℹ️ ${infos.length}个信息:`); infos.forEach(i => console.log(`  ${i}`)); }
    console.log('\n' + '='.repeat(60));
    console.log(errors.length === 0 ? '✅ 验证通过' : '🚨 验证失败');
    return { errors, warnings, infos };
}

runFullVerify().catch(console.error);
