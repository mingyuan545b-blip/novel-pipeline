const logger = require('../../../shared/logger');
const store = require('../../../store');
const { detectGenre } = require('../../genreConfig');
const { resolveConfig } = require('../../../config');
const { extractJSON } = require('../../jsonUtils');
const pipelineRegistry = require('../../pipelineRegistry');
const { addConstraint, autoResolveConstraints } = require('../../consistencyConstraint');
const { onReaderCheck } = require('../../pipelineModuleRegistry');

const READER_INTERVAL = 5;
const TOMATO_SUBGENRE_READER_TRIGGERS = {
    'tomato-revenge': [5, 10, 15, 20, 25],
    'tomato-sweet': [5, 10, 15, 20, 25],
    'tomato-mystery': [4, 8, 12, 16, 20, 24],
    'tomato-system': [5, 10, 15, 20, 25],
    'tomato-talisman': [5, 10, 14, 19, 24, 28]
};

function shouldTriggerReader(projectId, chapterNumber, mode, modeConfig, subGenre, genre) {
    const config = resolveConfig(genre, null);
    if (config.flow.skipSecondReview) {
        if (subGenre && TOMATO_SUBGENRE_READER_TRIGGERS[subGenre]) return TOMATO_SUBGENRE_READER_TRIGGERS[subGenre].includes(chapterNumber);
        const triggers = config.reader.triggers || [5, 10, 14];
        return triggers.includes(chapterNumber);
    }
    if (chapterNumber < READER_INTERVAL) return false;
    return chapterNumber % READER_INTERVAL === 0;
}

async function runReaderCheck(projectId, chapterId, chapterNumber, round, pipelineLog, onStep, mode, modeConfig, subGenre, genre) {
    if (!shouldTriggerReader(projectId, chapterNumber, mode, modeConfig, subGenre, genre)) return;
    const stepFn = pipelineRegistry.getStepFn();

    try {
        logger.info('readerCheck', `Chapter ${chapterNumber} reader check, running reader...`);
        const readerResult = await stepFn(projectId, chapterId, 'reader', round, {});
        pipelineLog.push(readerResult);
        if (onStep) onStep({ step: 'reader', round, passed: true, roleName: '阅读者' });
    } catch (readerErr) {
        logger.warn('readerCheck', 'Reader failed:', readerErr.message);
        pipelineLog.push({ step: 'reader', status: 'error', error: readerErr.message, timestamp: new Date().toISOString() });
        if (onStep) onStep({ step: 'reader', round, passed: false, roleName: '阅读者', feedback: { summary: `阅读者失败: ${readerErr.message}` } });
    }

    try {
        await autoResolveConstraints(projectId, chapterNumber);
    } catch (autoResErr) { logger.warn('readerCheck', 'Auto-resolve constraints failed:', autoResErr.message); }  // DEGRADE: 影响=autoResolveConstraints 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    try {
        const chapter = await store.getItem('chapters', chapterId);
        const readerOutput = chapter?.readerOutput || '';
        if (!readerOutput) return;
        try { await onReaderCheck(projectId, chapterNumber, readerOutput); } catch (_) { logger.warn('readerCheck', '[reader-check]', _.message || _); }  // DEGRADE: 影响=onReaderCheck 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        const parsed = extractJSON(readerOutput);
        const hardIssues = parsed?.hardIssues || [];
        if (hardIssues.length === 0) return;

        logger.info('readerCheck', `Reader found ${hardIssues.length} hard issues, writing consistency constraints + running reviser...`);

        for (const issue of hardIssues) {
            try {
                await addConstraint(projectId, {
                    type: issue.type || 'unknown',
                    description: issue.description || '',
                    constraint: issue.fixSuggestion || issue.description || '',
                    sourceChapter: issue.chapter || chapterNumber,
                    evidence: issue.evidence || ''
                });
            } catch (ccErr) { logger.warn('readerCheck', 'Failed to write consistency constraint:', ccErr.message); }  // DEGRADE: 影响=addConstraint 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        }

        const affectedChapters = [...new Set(hardIssues.map(i => i.chapter))].filter(Boolean);
        const allChaptersInRange = (await store.queryItems('chapters', { projectId }))
            .filter(c => !c.archived && affectedChapters.includes(c.chapterNumber));

        for (const affectedCh of allChaptersInRange) {
            try {
                const hardIssuesForChapter = hardIssues.filter(i => i.chapter === affectedCh.chapterNumber);
                const fixGuidance = hardIssuesForChapter.map(i =>
                    `【硬伤${i.type}: ${i.description}\n证据: ${i.evidence}\n修改建议: ${i.fixSuggestion}`
                ).join('\n\n');
                const reviseResult = await stepFn(projectId, affectedCh.id, 'reviser', round, {
                    reviewFeedback: `【阅读者发现的硬伤——必须修复】\n${fixGuidance}`
                });
                pipelineLog.push({ ...reviseResult, affectedChapter: affectedCh.chapterNumber });
                if (onStep) onStep({ step: 'reviser', round, passed: true, roleName: '返修员', chapterNumber: affectedCh.chapterNumber });
                try {
                    const reviserReviewId = `${affectedCh.id}_reviser_reader_r${round}`;
                    await store.setItem('reviews', reviserReviewId, {
                        id: reviserReviewId, chapterId: affectedCh.id, projectId,
                        step: 'reviser', type: 'reviser', round, passed: true,
                        content: `阅读者触发返修：修复${hardIssuesForChapter.length}处硬伤`,
                        issues: hardIssuesForChapter.map(i => ({ desc: `${i.type}: ${i.description}`, severity: 'high' })),
                        createdAt: new Date().toISOString()
                    });
                } catch (revReviewErr) { logger.warn('readerCheck', 'Failed to save reader-triggered reviser review:', revReviewErr.message); }  // DEGRADE: 影响=读者视角检查 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

                const revisedCh = await store.getItem('chapters', affectedCh.id);
                if (revisedCh?.content) {
                    try {
                        const reFinalResult = await stepFn(projectId, affectedCh.id, 'final-editor', round, {});
                        pipelineLog.push({ ...reFinalResult, affectedChapter: affectedCh.chapterNumber });
                        if (onStep) onStep({ step: 'final-editor', round, passed: reFinalResult.passed, roleName: '定稿人', chapterNumber: affectedCh.chapterNumber });
                        if (reFinalResult.passed) {
                            try { await stepFn(projectId, affectedCh.id, 'material-manager', round, {}); if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', chapterNumber: affectedCh.chapterNumber }); }
                            catch (reMatErr) { logger.warn('readerCheck', `Re-material-manager failed for chapter ${affectedCh.chapterNumber}:`, reMatErr.message); }  // DEGRADE: 影响=stepFn 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
                        }
                    } catch (reFinalErr) { logger.warn('readerCheck', `Re-final-editor failed for chapter ${affectedCh.chapterNumber}:`, reFinalErr.message); }  // DEGRADE: 影响=stepFn 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
                }
            } catch (reviseErr) { logger.warn('readerCheck', `Reviser failed for chapter ${affectedCh.chapterNumber}:`, reviseErr.message); }  // DEGRADE: 影响=stepFn 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        }
    } catch (readerPostErr) { logger.warn('readerCheck', 'Reader post-processing failed:', readerPostErr.message); }  // DEGRADE: 影响=stepFn 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
}

module.exports = { shouldTriggerReader, runReaderCheck, READER_INTERVAL, TOMATO_SUBGENRE_READER_TRIGGERS };
