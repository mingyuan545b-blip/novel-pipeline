/**
 * firstReviewChecks - 初审检测辅助函数
 */
const logger = require('../../../../shared/logger');
const { detectTellVerbs, calcInfoDripScore, extractEndingTension, detectCrossChapterRepetition, detectModernSlang, detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectCharacterNameMismatch, scanSensitiveWords, runGenreFirstReviewIntercept, checkWordCountGate } = require('./reviewShared');
const { buildHookRepetitionHint } = require('../../../hookRepetitionDetector');
const { buildPhraseTemplateHint } = require('../../../phraseTemplateDetector');
const { buildSupportingDepthHint } = require('./supportingRoleDepthCheck');
const { STATUS_VALUES } = require('../../../chapterStatus');

async function collectWritingTechniqueHints(chapter, ctx, project) {
    let hints = '';
    try {
        const content = chapter.content || '';
        const tellResult = detectTellVerbs(content);
        if (tellResult.count > 0) hints += `\n【展示代替告知检测】发现${tellResult.count}处告知式描写(density:${tellResult.density}/千字)，请检查是否需要转化为动作/生理/环境描写`;
        const dripScore = calcInfoDripScore(content);
        if (dripScore < 0.4) hints += `\n【信息注入节奏检测】info_drip_score=${dripScore.toFixed(2)}(<0.4)，存在连续设定说明，建议将信息包裹在动作冲突/对话博弈中`;
        const endingResult = extractEndingTension(content);
        if (!endingResult.hasTension) hints += `\n【章节收尾检测】末段缺乏张力点，请检查是否需要增加悬念/抉择/伏笔提及/关系转折`;
        const styleProfile = project?.styleProfile;
        const genreHints = runGenreFirstReviewIntercept(content, styleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreHints.hints?.length > 0) for (const hint of genreHints.hints) hints += '\n' + hint;
        try {
            const allChapters = await ctx.getChapters();
            const prevChapter = allChapters.filter(c => c.chapterNumber === chapter.chapterNumber - 1 && c.content && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED)).sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
            if (prevChapter) { const result = detectCrossChapterRepetition(content, prevChapter.content); if (result.hasRepetition) hints += `\n【跨章相似提示】与上一章存在${result.repeatedCount}处相似段落(重叠率${(result.overlapScore * 100).toFixed(0)}%)。注意：只有完全逐字粘贴才算major，相似描写只算minor。`; }

            // 章末钩子重复检测 + 台词模板重复检测（近5章窗口）
            // 章节完成状态是 'material-updated'（COMPLETED），不是 'approved'（IN_PROGRESS）
            // 修复Bug: 原过滤条件用错approved字面量永远不匹配，导致检测器无法触发
            const recentChapters = allChapters
                .filter(c => c.content && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED) && c.chapterNumber <= chapter.chapterNumber)
                .sort((a, b) => a.chapterNumber - b.chapterNumber)
                .slice(-5)
                .map(c => ({ chapterNumber: c.chapterNumber, content: c.content }));
            // 把当前章也加入窗口（当前章可能尚未完成，但需要检测）
            if (!recentChapters.find(c => c.chapterNumber === chapter.chapterNumber)) {
                recentChapters.push({ chapterNumber: chapter.chapterNumber, content });
            }
            const hookHint = buildHookRepetitionHint(recentChapters);
            if (hookHint) hints += `\n${hookHint}`;
            const phraseHint = buildPhraseTemplateHint(recentChapters);
            if (phraseHint) hints += `\n${phraseHint}`;
        } catch (e) { logger.warn('firstReview', 'cross-chapter check:', e.message || e); }
    } catch (e) { logger.warn('firstReview', e.message || e); }

    try { const conflicts = await ctx.detectTimelineConflicts(chapter.chapterNumber); if (conflicts.length > 0) hints += `\n【时间线矛盾检测】发现${conflicts.length}处时间矛盾：${conflicts.map(c => c.description).join('；')}`; } catch (e) { logger.warn('firstReview', e.message || e); }
    try { const h = await ctx.getPowerCheckHint(chapter.chapterNumber); if (h) hints += `\n${h}`; } catch (e) { logger.warn('firstReview', e.message || e); }
    try { const h = await ctx.getForeshadowCheckHint(chapter.chapterNumber); if (h) hints += `\n${h}`; } catch (e) { logger.warn('firstReview', e.message || e); }
    try { const h = await ctx.getCharacterArcCheckHint(chapter.chapterNumber); if (h) hints += `\n${h}`; } catch (e) { logger.warn('firstReview', e.message || e); }
    try { if (ctx.shouldRunAudit(chapter.chapterNumber)) { const report = await ctx.runFullAudit(chapter.chapterNumber); const { consistencyAuditService } = require('../../../consistencyAuditService'); const text = consistencyAuditService.formatAuditReport(report); if (text && !report.summary.passed) hints += `\n\n${text}`; } } catch (e) { logger.warn('firstReview', e.message || e); }

    // 配角反工具人化检测（检测内心描写/自主决策/反预期行为是否缺失）
    try {
        const depthHint = await buildSupportingDepthHint(ctx.projectId, chapter.chapterNumber);
        if (depthHint) hints += `\n${depthHint}`;
    } catch (e) { logger.warn('firstReview', `supporting depth: ${e.message}`); }

    return hints;
}

async function runHardBlockChecks(chapter, ctx, projectId) {
    const hardBlockIssues = [];
    const warningIssues = [];
    try {
        const content = chapter.content || '';
        const project = await ctx.getProject();
        const styleProfile = project?.styleProfile;

        const metadataLeak = detectPipelineMetadataLeak(content, styleProfile);
        if (metadataLeak.count > 0) { const notAllowable = metadataLeak.instances.filter(l => !l.allowable); if (notAllowable.length > 0) hardBlockIssues.push({ severity: 'critical', description: `管线元数据泄露：发现${notAllowable.length}处问题词汇`, title: '管线元数据泄露' }); }

        let crossChapterDup = null;
        try { const allChapters = await ctx.getChapters(); const prev = allChapters.filter(c => c.chapterNumber === chapter.chapterNumber - 1 && c.content && (c.status === STATUS_VALUES.MATERIAL_UPDATED || c.status === STATUS_VALUES.APPROVED)).sort((a, b) => b.chapterNumber - a.chapterNumber)[0]; if (prev) crossChapterDup = detectCrossChapterRepetition(content, prev.content); } catch (e) { logger.warn('firstReview', e.message || e); }
        if (crossChapterDup?.hasRepetition) warningIssues.push({ severity: 'high', description: `跨章重复：与上一章存在${crossChapterDup.repeatedCount}处相似段落`, title: '跨章内容重复' });

        let sensitiveBlock = false; let sensitiveHits = [];
        try { const scanResult = scanSensitiveWords(content); const blockHits = scanResult.hits.filter(h => h.severity === 'block'); if (blockHits.length > 0) { sensitiveBlock = true; sensitiveHits = blockHits; } } catch (e) { logger.warn('firstReview', e.message || e); }
        if (sensitiveBlock) hardBlockIssues.push({ severity: 'critical', description: `敏感词拦截：发现${sensitiveHits.length}处block级敏感词`, title: '敏感词拦截' });

        const wcBlocks = await checkWordCountGate(content, projectId);
        for (const b of wcBlocks) hardBlockIssues.push(b);

        const genreIntercept = runGenreFirstReviewIntercept(content, styleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreIntercept.hardBlockIssues?.length > 0) hardBlockIssues.push(...genreIntercept.hardBlockIssues);
        if (genreIntercept.warningIssues?.length > 0) warningIssues.push(...genreIntercept.warningIssues);

        try { const charMats = await ctx.getCharacterMaterials(); const charNames = charMats.filter(m => !m.archived).map(m => m.name).filter(Boolean); if (charNames.length > 0) { const nameResult = detectCharacterNameMismatch(content, charNames); if (nameResult.unknownNames.length > 0) warningIssues.push({ severity: 'medium', description: `可能有未知角色名：${nameResult.unknownNames.slice(0, 5).map(n => `"${n.name}"`).join('、')}`, title: '疑似未知角色名' }); } } catch (e) { logger.warn('firstReview', e.message || e); }
    } catch (e) { logger.warn('firstReview', e.message || e); }

    return { hardBlockIssues, warningIssues };
}

module.exports = { collectWritingTechniqueHints, runHardBlockChecks };
