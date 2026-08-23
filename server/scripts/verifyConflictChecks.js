function checkDuplicateRules(prompts, conflicts) {
    const { deduplicateSystemPrompt } = require('../services/agentPrompts');
    for (const [agentType, prompt] of Object.entries(prompts)) {
        const deduped = deduplicateSystemPrompt(prompt, agentType);
        if (deduped.length < prompt.length * 0.9) {
            conflicts.push({ agent: agentType, type: '重复规则', desc: `去重后减少${((1 - deduped.length / prompt.length) * 100).toFixed(1)}%`, severity: 'medium' });
        }
    }
}

function checkContradictions(prompts, conflicts) {
    for (const [agentType, prompt] of Object.entries(prompts)) {
        if (prompt.includes('第三人称') && prompt.includes('第一人称') && !prompt.includes('禁止第一人称')) {
            conflicts.push({ agent: agentType, type: '视角矛盾', desc: '同时出现第三人称和第一人称要求', severity: 'high' });
        }
        if (prompt.includes('快节奏') && prompt.includes('慢热')) {
            conflicts.push({ agent: agentType, type: '节奏矛盾', desc: '同时要求快节奏和慢热', severity: 'high' });
        }
        if (agentType === 'writer' && !prompt.includes('系统面板') && !prompt.includes('禁止')) {
            conflicts.push({ agent: agentType, type: '禁止格式缺失', desc: '未包含禁止格式检查', severity: 'medium' });
        }
    }
}

function checkCriticalRules(prompts, conflicts) {
    const rules = [
        { name: '第三人称限知视角', check: p => p.includes('第三人称限知') || p.includes('限知视角') },
        { name: '甜宠靠行动', check: p => p.includes('甜宠靠行动') || p.includes('行动不靠嘴') },
        { name: '市井烟火', check: p => p.includes('市井烟火') }
    ];
    for (const rule of rules) {
        for (const [agentType, prompt] of Object.entries(prompts)) {
            if (!rule.check(prompt)) conflicts.push({ agent: agentType, type: '关键规则缺失', desc: `未检测到"${rule.name}"规则`, severity: 'medium' });
        }
    }
}

function checkWordLimits(prompts, conflicts) {
    for (const [agentType, prompt] of Object.entries(prompts)) {
        if (agentType === 'writer' && !prompt.includes('rejectMin') && !prompt.includes('minWordCount') && !prompt.includes('2000')) {
            conflicts.push({ agent: agentType, type: '字数限制缺失', desc: '未检测到字数限制', severity: 'high' });
        }
    }
}

function runAllConflictChecks(prompts) {
    const conflicts = [];
    checkDuplicateRules(prompts, conflicts);
    checkContradictions(prompts, conflicts);
    checkCriticalRules(prompts, conflicts);
    checkWordLimits(prompts, conflicts);
    return conflicts;
}

module.exports = { runAllConflictChecks };
