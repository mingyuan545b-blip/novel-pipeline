const logger = require('../../../shared/logger');
const store = require('../../../store');
const { cleanChapterContent, deduplicateContent } = require('../../contentUtils');
const { resolveGenreFromProject } = require('../../genreConfig');
const { saveAgentOutput } = require('../../fileOutput');
const { buildReviserContext } = require('./reviserPrompt');
const { guardWordCount } = require('./reviserWordGuard');

async function handleReviser({ projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput: _saveOutput, round, modeConfig, project }) {
    const { scheduled } = await buildReviserContext({ projectId, chapter, materials, agentContext, context, project });

    const result = await runAgent('reviser', agentContext);
    logger.info('reviser', `Reviser response length: ${(result.response || '').length}`);

    if (!result.response) {
        logger.warn('reviser', 'Reviser returned empty response');
        chapter.reviserOutput = '[返修员返回空响应，保留原文]';
        chapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapter.id, chapter);
        return { step: 'reviser', result, passed: false, feedback: { summary: '返修员返回空响应', issues: [{ desc: '返修员返回空响应', severity: 'high' }], suggestions: [] }, chapter };
    }

    const reviserContent = cleanChapterContent(result.response);
    const originalContent = chapter.content || chapter.writerOutput || '';
    const genre = resolveGenreFromProject(project);
    const { content: finalContent, wordCount } = guardWordCount(reviserContent, originalContent, genre, project);

    chapter.content = finalContent;
    chapter.reviserOutput = finalContent;
    chapter.reviserOutputRaw = result.response.substring(0, 5000);
    chapter.round = round;
    chapter.wordCount = wordCount;

    const dedup = deduplicateContent(finalContent);
    if (dedup.removed > 0) {
        chapter.content = dedup.content;
        chapter.wordCount = dedup.content.replace(/\s/g, '').length;
    }

    _saveOutput(projectId, chapter, 'reviser', result.response);
    logger.info('reviser', `Reviser saved: ${wordCount} chars (original: ${originalContent.replace(/\s/g, '').length})`);
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);

    return { step: 'reviser', result, passed: true, chapter };
}

module.exports = { handleReviser };
