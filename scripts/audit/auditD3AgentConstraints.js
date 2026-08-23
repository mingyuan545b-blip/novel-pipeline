'use strict';

/**
 * auditD3AgentConstraints.js — D3: agent约束完整性+冲突重叠
 *
 * 检查agentSlotRegistry引用的moduleIds是否在CONSTRAINT_MODULES中存在
 * 检查两套约束系统（constraintAgentMap vs agentJobTemplates）的agent列表一致性
 * 检查constraintScopes的WRITING/REVIEW分类完整性
 */

const { critical, warn, info, ok, readFile, collectDefinedModuleIds } = require('./auditUtils');

function auditAgentConstraints() {
    console.log('\n=== D3: agent约束完整性+冲突重叠 ===');

    // D3.1: agentSlotRegistry的moduleIds能否在CONSTRAINT_MODULES找到
    // 使用递归收集器识别 ...EXTRA_CONSTRAINT_MODULES 展开语法
    const slotRegistry = readFile('server/services/prompts/agentSlotRegistry.js');

    if (slotRegistry) {
        const definedIds = collectDefinedModuleIds();

        // 提取SLOT_DEFINITIONS引用的moduleIds
        const slotDefMatch = slotRegistry.matchAll(/moduleIds:\s*\[([^\]]+)\]/g);
        const referencedIds = new Set();
        for (const m of slotDefMatch) {
            const ids = m[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
            for (const id of ids) {
                if (id) referencedIds.add(id);
            }
        }

        const missing = [...referencedIds].filter(id => !definedIds.has(id));
        if (missing.length > 0) {
            critical('D3.1', 'agentSlotRegistry引用的moduleIds在CONSTRAINT_MODULES中不存在', {
                missing,
                definedCount: definedIds.size,
                referencedCount: referencedIds.size,
                impact: 'resolveModulesSlot返回null，role-boundary/redlines-writer/quality-check/craft-rules等约束全部丢失'
            });
        } else {
            ok('D3.1', `所有${referencedIds.size}个moduleIds都能在CONSTRAINT_MODULES找到（共${definedIds.size}个已定义）`);
        }
    }

    // D3.2: 两套约束系统对比
    const constraintAgentMap = readFile('server/services/prompts/constraintAgentMap.js');
    const agentJobTemplates = readFile('server/services/prompts/agentJobTemplates.js');

    if (constraintAgentMap && agentJobTemplates) {
        const mapAgents = new Set();
        const mapMatch = constraintAgentMap.matchAll(/^\s*'([\w-]+)':\s*\[/gm);
        for (const m of mapMatch) mapAgents.add(m[1]);

        const templateAgents = new Set();
        const templateMatch = agentJobTemplates.matchAll(/^\s*'([\w-]+)':\s*\{/gm);
        for (const m of templateMatch) templateAgents.add(m[1]);

        const onlyInMap = [...mapAgents].filter(a => !templateAgents.has(a));
        const onlyInTemplate = [...templateAgents].filter(a => !mapAgents.has(a));

        if (onlyInMap.length > 0 || onlyInTemplate.length > 0) {
            // 两条约束注入路径并存是设计，非bug：
            // 旧路径(promptBuilder→constraintModules→constraintAgentMap)用perspective/genre模块ID，仅用于genre-debug调试
            // 新路径(agentPromptAssembler→agentSlotRegistry)用role-boundary/redline-format模块ID，用于主流程
            // 两条路径服务的agent列表不同是正常的
            info('D3.2', '两套约束系统agent列表不一致（设计决策：旧路径用于调试，新路径用于主流程）', {
                onlyInConstraintAgentMap: onlyInMap,
                onlyInAgentJobTemplates: onlyInTemplate,
                oldPathUsage: 'genre-debug.js + startupVerifyChecks.js',
                newPathUsage: 'agentRunner.js (主流程)',
                impact: '无功能影响，两条路径独立运行'
            });
        } else {
            ok('D3.2', '两套系统agent列表一致');
        }
    }

    // D3.3: constraintScopes的agent分类
    const constraintScopes = readFile('server/services/prompts/constraintScopes.js');
    if (constraintScopes && agentJobTemplates) {
        const writingAgentsMatch = constraintScopes.match(/WRITING_AGENTS\s*=\s*new Set\(\[([^\]]+)\]\)/);
        const reviewAgentsMatch = constraintScopes.match(/REVIEW_AGENTS\s*=\s*new Set\(\[([^\]]+)\]\)/);
        const readerAgentsMatch = constraintScopes.match(/READER_AGENTS\s*=\s*new Set\(\[([^\]]+)\]\)/);

        if (writingAgentsMatch && reviewAgentsMatch) {
            const writingAgents = writingAgentsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
            const reviewAgents = reviewAgentsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
            const readerAgents = readerAgentsMatch ? readerAgentsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')) : [];

            const overlap = writingAgents.filter(a => reviewAgents.includes(a));
            if (overlap.length > 0) {
                warn('D3.3', 'WRITING_AGENTS和REVIEW_AGENTS有重叠', overlap);
            } else {
                ok('D3.3', 'WRITING_AGENTS和REVIEW_AGENTS无重叠');
            }

            const templateAgents = new Set();
            const templateMatch = agentJobTemplates.matchAll(/^\s*'([\w-]+)':\s*\{/gm);
            for (const m of templateMatch) templateAgents.add(m[1]);

            const allClassified = new Set([...writingAgents, ...reviewAgents, ...readerAgents]);
            const unclassified = [...templateAgents].filter(a => !allClassified.has(a));
            if (unclassified.length > 0) {
                warn('D3.3b', 'agentJobTemplates的agent未在constraintScopes分类', unclassified);
            } else {
                ok('D3.3b', `所有agent已分类（WRITING:${writingAgents.length} + REVIEW:${reviewAgents.length} + READER:${readerAgents.length}）`);
            }
        }
    }

    // D3.4: constraintDedupe的keywords是否误删
    const constraintDedupe = readFile('server/services/prompts/constraintDedupe.js');
    if (constraintDedupe) {
        const charConsistencyMatch = constraintDedupe.match(/'character-consistency':\s*\{[^}]*keywords:\s*\[([^\]]+)\]/);
        if (charConsistencyMatch) {
            const keywords = charConsistencyMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
            if (keywords.includes('角色')) {
                warn('D3.4', 'character-consistency的keywords包含"角色"', { keywords, impact: '会被povRule误触发去重' });
            } else {
                ok('D3.4', 'character-consistency的keywords已移除"角色"关键词');
            }
        }
    }
}

module.exports = { auditAgentConstraints };
