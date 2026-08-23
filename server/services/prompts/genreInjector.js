const logger = require('../../shared/logger');
const { normalizeTargetChapters } = require('../../config/targetChaptersNormalizer');
const { recordDegradation } = require('../pipeline/degradationTracker');

async function buildGenreInjection(projectId, agentType, project, options = {}) {
    const result = { text: '', logEntries: [] };
    // 注意：这里的agent分类与constraintScopes.WRITING_AGENTS不同
    // constraintScopes.WRITING_AGENTS包含outline/material-manager（需要写作约束）
    // genreInjector只对"执笔类"agent注入genre信息（namingStyle/memeLexicon等）
    // outline/material-manager不需要genre注入，因为它们不直接生成正文
    const isWritingAgent = ['writer', 'reviser', 'polisher', 'intent-planner'].includes(agentType);
    const isReviewAgent = ['first-review', 'second-review', 'fast-review', 'final-editor'].includes(agentType);

    let _genreProfile = null;
    try {
        const genreProfileRegistry = require('../genreProfileRegistry');
        const genreProfileId = project.styleProfile?.genreProfile || '';
        _genreProfile = genreProfileId ? genreProfileRegistry.get(genreProfileId) : genreProfileRegistry.resolve(project.genre || '');
        if (_genreProfile) {
            const genreBlock = genreProfileRegistry.buildWriterPromptBlock(_genreProfile.id);
            if (genreBlock && isWritingAgent) { result.text += '\n\n' + genreBlock; result.logEntries.push({ step: 'genreProfile', chars: genreBlock.length }); }
        } else if (isWritingAgent) {
            // Fallback: genreProfileRegistry 无数据时（data/genre-profiles目录缺失），从题材插件获取 reviewFocus/materialFocus
            const { resolveGenreFromProject } = require('../genreConfig');
            const genrePlugin = resolveGenreFromProject(project);
            if (genrePlugin?.styleProfile) {
                const pluginSP = genrePlugin.styleProfile;
                const parts = [`【题材适配配置：${genrePlugin.label || pluginSP.label || ''}】`];
                const rf = typeof pluginSP.reviewFocus === 'string' ? pluginSP.reviewFocus.split(/[；;]/).map(s => s.trim()).filter(Boolean) : [];
                if (rf.length) parts.push(`审核重点：${rf.join('；')}`);
                const mf = typeof pluginSP.materialFocus === 'object' && pluginSP.materialFocus
                    ? [...(pluginSP.materialFocus.primary || []), ...(pluginSP.materialFocus.secondary || [])]
                    : (typeof pluginSP.materialFocus === 'string' ? pluginSP.materialFocus.split(/[、,]/).map(s => s.trim()).filter(Boolean) : []);
                if (mf.length) parts.push(`素材重点：${mf.join('、')}`);
                const genreBlock = parts.join('\n');
                if (genreBlock) { result.text += '\n\n' + genreBlock; result.logEntries.push({ step: 'genreProfile', chars: genreBlock.length }); }
            }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'genreProfile', _.message || String(_)); }

    try {
        const namingStyleRegistry = require('../namingStyleRegistry');
        if (isWritingAgent) {
            const namingBlock = await namingStyleRegistry.buildCombinedPromptBlock(projectId);
            if (namingBlock) { result.text += '\n\n' + namingBlock; result.logEntries.push({ step: 'namingStyle', chars: namingBlock.length }); }
        } else if (isReviewAgent) {
            const namingReviewBlock = await namingStyleRegistry.buildCombinedReviewBlock(projectId);
            if (namingReviewBlock) { result.text += '\n\n' + namingReviewBlock; result.logEntries.push({ step: 'namingStyle-review', chars: namingReviewBlock.length }); }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'namingStyle', _.message || String(_)); }

    try {
        const memeLexicon = require('../memeLexicon');
        if (isWritingAgent) {
            const memeBlock = memeLexicon.buildWriterPrompt(projectId);
            if (memeBlock) { result.text += '\n\n' + memeBlock; result.logEntries.push({ step: 'memeLexicon', chars: memeBlock.length }); }
        } else if (isReviewAgent) {
            const memeReviewBlock = memeLexicon.buildReviewerPrompt(projectId);
            if (memeReviewBlock) { result.text += '\n\n' + memeReviewBlock; result.logEntries.push({ step: 'memeLexicon-review', chars: memeReviewBlock.length }); }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'memeLexicon', _.message || String(_)); }

    try {
        const worldviewTemplateRegistry = require('../worldviewTemplateRegistry');
        const wvTemplateId = project.styleProfile?.worldviewTemplate || (_genreProfile?.worldviewTemplate || '');
        const inferred = wvTemplateId ? worldviewTemplateRegistry.get(wvTemplateId) : worldviewTemplateRegistry.inferFromGenre(project.genre || '');
        if (inferred) {
            const chapterNumber = options?.chapterNumber || 1;
            const totalChapters = normalizeTargetChapters(project);
            if (isWritingAgent) {
                const wvBlock = worldviewTemplateRegistry.buildWriterPrompt(inferred.id, chapterNumber, totalChapters);
                if (wvBlock) { result.text += '\n\n' + wvBlock; result.logEntries.push({ step: 'worldviewTemplate', chars: wvBlock.length }); }
            } else if (isReviewAgent) {
                const wvReviewBlock = worldviewTemplateRegistry.buildReviewerPrompt(inferred.id, chapterNumber, totalChapters);
                if (wvReviewBlock) { result.text += '\n\n' + wvReviewBlock; result.logEntries.push({ step: 'worldviewTemplate-review', chars: wvReviewBlock.length }); }
            }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'worldviewTemplate', _.message || String(_)); }

    try {
        const characterArchetypeRegistry = require('../characterArchetypeRegistry');
        if (isWritingAgent) {
            const archBlock = await characterArchetypeRegistry.buildCombinedWriterPrompt(project.id);
            if (archBlock) { result.text += '\n\n' + archBlock; result.logEntries.push({ step: 'characterArchetype', chars: archBlock.length }); }
        } else if (isReviewAgent) {
            const archReviewBlock = await characterArchetypeRegistry.buildCombinedReviewerPrompt(project.id);
            if (archReviewBlock) { result.text += '\n\n' + archReviewBlock; result.logEntries.push({ step: 'characterArchetype-review', chars: archReviewBlock.length }); }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'characterArchetype', _.message || String(_)); }

    try {
        const systemPersonaRegistry = require('../systemPersonaRegistry');
        if (isWritingAgent) {
            const spBlock = await systemPersonaRegistry.buildCombinedWriterPrompt(project.id);
            if (spBlock) { result.text += '\n\n' + spBlock; result.logEntries.push({ step: 'systemPersona', chars: spBlock.length }); }
        } else if (isReviewAgent) {
            const spReviewBlock = await systemPersonaRegistry.buildCombinedReviewerPrompt(project.id);
            if (spReviewBlock) { result.text += '\n\n' + spReviewBlock; result.logEntries.push({ step: 'systemPersona-review', chars: spReviewBlock.length }); }
        }
    } catch(_) { logger.warn('genreInjector', '[SILENT-CATCH]', { value1: _.message || _ }); recordDegradation('genreInjector', 'systemPersona', _.message || String(_)); }

    return result;
}

module.exports = {
    buildGenreInjection
};
