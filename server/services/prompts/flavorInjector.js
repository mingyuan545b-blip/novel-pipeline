const store = require('../../store');
const logger = require('../../shared/logger');

async function buildFlavorInjection(projectId, agentType, genre) {
    const result = { text: '', logEntries: [] };
    // 注意：这里的agent分类与constraintScopes.WRITING_AGENTS不同
    // constraintScopes.WRITING_AGENTS包含outline/material-manager（需要写作约束）
    // flavorInjector只对"执笔类"agent注入风味信息（speechStyle等）
    // outline/material-manager不需要风味注入，因为它们不直接生成正文
    const isWritingAgent = ['writer', 'reviser', 'polisher', 'intent-planner'].includes(agentType);
    const isReviewAgent = ['first-review', 'second-review', 'fast-review', 'final-editor'].includes(agentType);

    try {
        const speechStylePrompts = require('../speechStylePrompts');
        const allMats = await store.queryItems('materials', { projectId });
        const flavorChars = allMats.filter(m => !m.archived && m.type === 'character' && (m.dialectRegion || m.speechStyle));

        if (flavorChars.length > 0) {
            if (isWritingAgent) {
                const combinedBlock = speechStylePrompts.buildCombinedPromptBlock(flavorChars);
                if (combinedBlock) { result.text += '\n\n' + combinedBlock; result.logEntries.push({ step: 'flavor-writing', chars: combinedBlock.length }); }
                if (genre?.dialectConfig?.rules?.length) {
                    const dr = '【题材方言交互规则】\n' + genre.dialectConfig.rules.join('\n');
                    result.text += '\n\n' + dr;
                    result.logEntries.push({ step: 'dialectConfig', chars: dr.length });
                }
            } else if (isReviewAgent) {
                const reviewBlock = speechStylePrompts.buildCombinedReviewBlock(flavorChars);
                if (reviewBlock) { result.text += '\n\n' + reviewBlock; result.logEntries.push({ step: 'flavor-review', chars: reviewBlock.length }); }
            }
        }
    } catch(_) { logger.warn('flavorInjector', '[SILENT-CATCH]', { value1: _.message || _ }); }

    return result;
}

module.exports = {
    buildFlavorInjection
};
