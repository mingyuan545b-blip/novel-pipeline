const path = require('path');
const fs = require('fs');

function checkModuleLoads(errors, infos) {
    const modules = [
        ['store', '../store'],
        ['llm', '../services/llm'],
        ['genreConfig', '../services/genreConfig'],
        ['agentPrompts', '../services/agentPrompts'],
        ['promptAuditor', '../services/promptAuditor'],
        ['agentRunner', '../services/pipeline/agentRunner']
    ];
    for (const [name, modPath] of modules) {
        try {
            const mod = require(modPath);
            if (name === 'genreConfig' && mod.GENRE_REGISTRY) infos.push(`✅ ${name}加载成功，题材数: ${mod.GENRE_REGISTRY.length}`);
            else infos.push(`✅ ${name}加载成功`);
        } catch (e) { errors.push(`❌ ${name}加载失败: ${e.message}`); }
    }
}

function checkChapterNumberBug(errors, infos) {
    const filePath = path.join(__dirname, '../services/agentPrompts.js');
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('context?.chapterNumber')) errors.push('❌ BUG: agentPrompts使用未定义的context?.chapterNumber');
    else infos.push('✅ 无context?.chapterNumber bug');
}

function checkDedupCall(warnings, infos) {
    const filePath = path.join(__dirname, '../services/pipeline/agentRunner.js');
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(/deduplicateSystemPrompt\(([^)]+)\)/g) || [];
    const hasProfile = matches.some(m => m.includes('profile'));
    if (hasProfile) infos.push('✅ deduplicateSystemPrompt调用已传入profile');
    else warnings.push('⚠️ deduplicateSystemPrompt调用缺少profile参数');
}

function checkEnvVars(errors, warnings, infos) {
    const envPath = path.join(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) { warnings.push('⚠️ .env文件不存在'); return; }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
    envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).forEach(l => {
        const [key, ...val] = l.split('=');
        if (key && val.length > 0) envVars[key.trim()] = val.join('=').trim();
    });
    for (const v of ['LLM_PROVIDER', 'PORT']) { if (!envVars[v]) errors.push(`❌ 缺少环境变量: ${v}`); else infos.push(`✅ ${v}=${envVars[v]}`); }
    for (const v of ['ALIYUN_CODING_API_KEY', 'DEEPSEEK_API_KEY']) {
        if (envVars[v] && !envVars[v].includes('your_') && envVars[v] !== '') infos.push(`✅ ${v}已配置`);
        else if (envVars[v]) warnings.push(`⚠️ ${v}未配置`);
    }
}

async function checkAgentAssembly(errors, warnings, infos) {
    try {
        const { getAgentPrompt, buildFoundationPrompt, deduplicateSystemPrompt } = require('../services/agentPrompts');
        for (const t of ['writer', 'first-review', 'second-review', 'final-editor']) {
            try {
                const agent = await getAgentPrompt(t, 'novel', null);
                const fp = await buildFoundationPrompt(t, 'novel', null);
                const raw = fp + '\n\n' + (agent.system || '');
                const full = deduplicateSystemPrompt(raw, t);
                infos.push(`✅ ${t}: 总计${full.length}字符`);
                const ph = full.match(/\{[^}]+\}/g);
                if (ph?.length > 0) warnings.push(`⚠️ ${t}: 未替换占位符: ${ph.slice(0, 3).join(',')}`);
                const wc = full.match(/【字数要求】/g);
                if (wc?.length > 1) warnings.push(`⚠️ ${t}: 【字数要求】出现${wc.length}次`);
            } catch (e) { errors.push(`❌ ${t}组装失败: ${e.message}`); }
        }
    } catch (e) { errors.push(`❌ agent组装流程失败: ${e.message}`); }
}

module.exports = { checkModuleLoads, checkChapterNumberBug, checkDedupCall, checkEnvVars, checkAgentAssembly };
