const logger = require('../../../shared/logger');
const store = require('../../../store');
const { cleanChapterContent, deduplicateContent } = require('../../contentUtils');
const { resolveGenreFromProject } = require('../../genreConfig');
const { saveAgentOutput } = require('../../fileOutput');
const { buildReviserContext } = require('./reviserPrompt');
const { guardWordCount } = require('./reviserWordGuard');
const { needsExpansionRetry, buildEscalationNote } = require('./expansionInstructionBuilder');

async function handleReviser({ projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput: _saveOutput, round, modeConfig, project }) {
    const { scheduled, expansionTask } = await buildReviserContext({ projectId, chapter, materials, agentContext, context, project });

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
    const guarded = guardWordCount(reviserContent, originalContent, genre, project);
    let finalContent = guarded.content;
    let wordCount = guarded.wordCount;
    let savedResponse = result.response;

    const dedup = deduplicateContent(finalContent);
    if (dedup.removed > 0) {
        finalContent = dedup.content;
        wordCount = dedup.content.replace(/\s/g, '').length;
    }

    // 扩写任务步内升级重试：flash级模型对扩写指令服从性有波动（2026-09-06实测首轮+0字），
    // 若等下游first-review拒绝会白烧一整轮，此处带失败事实立即重试一次，取更长者
    if (needsExpansionRetry(expansionTask, wordCount)) {
        logger.warn('reviser', `扩写未达标(${wordCount}/${expansionTask.targetMin}字)，步内升级重试`);
        agentContext.content += buildEscalationNote(wordCount, expansionTask.targetMin);
        const retryResult = await runAgent('reviser', agentContext);
        if (retryResult.response) {
            const retryGuarded = guardWordCount(cleanChapterContent(retryResult.response), finalContent, genre, project);
            const retryDedup = deduplicateContent(retryGuarded.content);
            const retryContent = retryDedup.removed > 0 ? retryDedup.content : retryGuarded.content;
            const retryWc = retryContent.replace(/\s/g, '').length;
            if (retryWc > wordCount) {
                logger.info('reviser', `步内重试生效: ${wordCount}→${retryWc}字`);
                finalContent = retryContent; wordCount = retryWc; savedResponse = retryResult.response;
            } else {
                logger.warn('reviser', `步内重试未提升(${retryWc}字)，保留首轮输出`);
            }
        }
    }

    chapter.content = finalContent;
    chapter.reviserOutput = finalContent;
    chapter.reviserOutputRaw = savedResponse.substring(0, 5000);
    chapter.round = round;
    chapter.wordCount = wordCount;

    _saveOutput(projectId, chapter, 'reviser', savedResponse);
    logger.info('reviser', `Reviser saved: ${wordCount} chars (original: ${originalContent.replace(/\s/g, '').length})`);
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);

    return { step: 'reviser', result, passed: true, chapter };
}

module.exports = { handleReviser };
