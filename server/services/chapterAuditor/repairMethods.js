const logger = require('../../shared/logger');
const store = require('../../store');
const { auditChapter } = require('./auditMethods');
const { reviewChapter } = require('./reviewMethods');
const { _getDefaultRepairConfig, _buildApiConfig, _generateDiff, _updateMaterial } = require('./helpers');
const { _runHardBlockChecks } = require('./hardBlockChecks');
const { _runFollowUpPipeline } = require('./repairFollowUp');
const { getStyleProfileForProject } = require('../agentPrompts');
const { getGenreReviewRules, resolveGenreFromProject } = require('../genreConfig');
const { resolveConfig } = require('../../config');
const { cleanChapterContent, deduplicateContent, cleanFinalContent, truncateChapter, ensureCliffhanger, validateTomatoMetrics } = require('../contentUtils');

async function repairChapter(projectId, project, styleProfile, genre, genreLabel, chapterId, repairInstructions, llmService, options = {}) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return { success: false, error: '章节不存在' };
    const audit = await auditChapter(projectId, project, styleProfile, genre, chapterId);
    if (audit.clean) return { success: false, error: '章节无违规，无需返修' };
    const oldContent = chapter.content || '';
    const oldWordCount = oldContent.replace(/\s/g, '').length;

    const violationSummary = audit.violations.map(v => {
        let line = `[${v.severity}][${v.category}] ${v.desc}`;
        if (v.match) line += ` | 原文匹配:"${v.match}"`;
        if (v.suggestion) line += ` | 建议:${v.suggestion}`;
        if (v.jargons && v.jargons.length > 0) line += ` | 术语替换:${v.jargons.map(j => `"${j.match}"→"${j.suggestion}"`).join('、')}`;
        if (v.type === 'wordCountTooLow') line += ` | 当前${v.current}字，目标${v.target}字，差${v.gap}字`;
        if (v.type === 'wordCountTooHigh') line += ` | 当前${v.current}字，上限${v.target}字，超${v.gap}字`;
        return line;
    }).join('\n');

    const styleSection = styleProfile ? `\n【本作风格配置（最高优先级，与返修规则冲突时以此为准）】\n视角规则: ${styleProfile.povRule || ''}\n对话规则: ${styleProfile.dialogueRule || ''}\n行为规则: ${styleProfile.behaviorRule || ''}\n语气基调: ${styleProfile.toneRule || ''}\n称呼规范: ${styleProfile.characterRefRules || ''}` : '';

    const reviewFeedback = chapter.firstReviewOutput || chapter.secondReviewOutput || '';
    const reviewIssues = _parseReviewFeedback(reviewFeedback);

    const _repairReviewRules = getGenreReviewRules(genre);
    const _repairTerminologyDimmingRule = _repairReviewRules?.reviser?.terminologyDimmingRule || '';
    const _repairPerspectiveRule = _repairReviewRules?.reviser?.perspectiveRule || '';
    const _repairRepairRules = _repairReviewRules?.reviser?.repairRules || '';

    const repairPrompt = _buildRepairPrompt(chapter, oldWordCount, violationSummary, reviewIssues, styleSection, repairInstructions, _repairRepairRules, _repairTerminologyDimmingRule, _repairPerspectiveRule);

    try {
        let apiConfig;
        if (options.provider) apiConfig = _buildApiConfig(options.provider, options.model);
        else apiConfig = _getDefaultRepairConfig(project, project?.agentModelConfig);

        const messages = [
            { role: 'system', content: '你是专业小说返修编辑。只输出修改后的完整正文，禁止输出思考/注释/大纲。' },
            { role: 'user', content: repairPrompt + '\n\n【原文】\n' + oldContent }
        ];
        logger.info('repairMethods', `[AUDITOR] Repair Ch${chapter.chapterNumber} using ${apiConfig.provider}/${apiConfig.model}`);
        const result = await llmService.chat(messages, { maxTokens: 32768, apiConfig });
        const usedModel = result?.model || apiConfig.model || 'unknown';
        const usedProvider = apiConfig.provider || 'unknown';

        let newContent = _extractContent(result);
        if (!newContent) return { success: false, error: 'LLM返回格式异常', usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };

        newContent = cleanChapterContent(newContent);
        newContent = (deduplicateContent(newContent).content || newContent);
        newContent = cleanFinalContent(newContent);
        if (typeof newContent !== 'string') newContent = String(newContent || '');

        const _auditConfig2 = resolveConfig(resolveGenreFromProject(project), project);
        const projectMode = project?.mode || 'novel';
        if (projectMode === 'tomato-short') { const v = validateTomatoMetrics(newContent); if (!v.pass) logger.warn('repairMethods', `[AUDITOR] 番茄硬校验未通过: ${v.reason}`); }
        if (projectMode === 'shuangwen' || projectMode === 'tomato-short') newContent = ensureCliffhanger(newContent);

        const wordCheckResult = _checkWordCount(newContent, oldWordCount, _auditConfig2);
        if (!wordCheckResult.pass) return { ...wordCheckResult.error, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };
        if (wordCheckResult.truncated) newContent = wordCheckResult.content;

        const hardBlockResult = await _runHardBlockChecks(newContent, styleProfile, project, projectId, store);
        if (hardBlockResult.blocked) return { success: false, error: `返修后硬性检测拦截：${hardBlockResult.issues.join('；')}`, hardBlockIssues: hardBlockResult.issues, usedModel, usedProvider, chapterNumber: chapter.chapterNumber, chapterId };

        const finalWordCount = newContent.replace(/\s/g, '').length;
        const snapshot = { id: `snap_repair_${Date.now()}`, chapterId, projectId, oldContent: oldContent.substring(0, 5000), oldWordCount, oldPolishedContent: (chapter.polishedContent || '').substring(0, 5000), oldNormalContent: (chapter.normalContent || '').substring(0, 5000), repairedAt: new Date().toISOString(), repairInstructions, violationsFixed: audit.violations.map(v => v.type) };
        store.setItem('repair-snapshots', snapshot.id, snapshot);

        chapter.content = newContent; chapter.normalContent = newContent; chapter.polishedContent = newContent; chapter.updatedAt = new Date().toISOString(); chapter._needsReReview = true;
        if (!chapter.history) chapter.history = [];
        chapter.history.push({ round: 0, step: 'targeted-repair', content: newContent.substring(0, 500), wordCount: finalWordCount, repairInstructions, usedModel, usedProvider, timestamp: new Date().toISOString() });
        store.setItem('chapters', chapterId, chapter);

        const reAudit = await auditChapter(projectId, project, styleProfile, genre, chapterId);
        await _updateMaterial(projectId, chapterId, oldContent, newContent, store);

        const repairResult = { success: true, chapterNumber: chapter.chapterNumber, chapterId, oldWordCount, newWordCount: finalWordCount, wordCountDelta: finalWordCount - oldWordCount, violationsBefore: audit.violations.length, violationsAfter: reAudit.violations.length, violationsFixed: audit.violations.length - reAudit.violations.length, remainingViolations: reAudit.violations, snapshotId: snapshot.id, usedModel, usedProvider, reviewResults: null, contentBefore: oldContent, contentAfter: newContent, contentDiff: _generateDiff(oldContent, newContent) };
        if (options.autoReview) repairResult.reviewResults = await reviewChapter(projectId, project, styleProfile, genre, genreLabel, chapterId, llmService, apiConfig);
        return repairResult;
    } catch (err) {
        logger.error('repairMethods', '[CHAPTER_AUDITOR] Repair error:', err);
        return { success: false, error: err.message };
    }
}

function _parseReviewFeedback(reviewFeedback) {
    try {
        const parsed = typeof reviewFeedback === 'string' ? JSON.parse(reviewFeedback.match(/\{[\s\S]*\}/)?.[0] || '{}') : reviewFeedback;
        const issues = parsed.issues || [];
        const suggestions = parsed.suggestions || [];
        let text = '';
        if (issues.length > 0) text += '审核问题（必须逐条修复）:\n' + issues.map(i => { let line = `- [${i.severity || 'medium'}] ${i.title || ''}`; if (i.location) line += ` | 位置: ${i.location}`; if (i.originalText) line += ` | 原文: "${i.originalText}"`; if (i.perspective) line += ` | 视角: ${i.perspective}`; if (i.violationReason) line += ` | 违规原因: ${i.violationReason}`; if (i.howToFix) line += ` | 修改方式: ${i.howToFix}`; if (i.targetText) line += ` | 改为: "${i.targetText}"`; if (!i.originalText && !i.violationReason && i.description) line += ` | ${i.description}`; return line; }).join('\n');
        if (suggestions.length > 0) text += '\n审核建议:\n' + suggestions.map(s => `- ${s.title}: ${s.description}`).join('\n');
        return text;
    } catch { return ''; }
}

function _buildRepairPrompt(chapter, oldWordCount, violationSummary, reviewIssues, styleSection, repairInstructions, repairRules, terminologyRule, perspectiveRule) {
    const prompt = `你是小说返修专家。请严格按以下要求修改章节内容。\n\n【章节信息】第${chapter.chapterNumber}章 "${chapter.title}" (${oldWordCount}字)\n\n【检测到的违规问题】\n${violationSummary}\n${reviewIssues ? '\n【审核员反馈（必须逐条修复）】\n' + reviewIssues : ''}\n${styleSection}\n\n【人工返修指令】\n${repairInstructions || '请修复上述所有违规问题，保持原文风格和情节不变'}\n\n【返修规则 - 必须严格遵守，违反任何一条将被拒绝】\n${repairRules ? repairRules : `1. 【视角越界修复核心原则】用角色感知段落替换全知旁白/纯叙述段落，保持情节推进不变`}\n2. 修改后字数必须在${oldWordCount > 2800 ? Math.floor(Math.min(oldWordCount * 0.75, 2800 * 0.8)) : Math.floor(oldWordCount * 0.75)}~${oldWordCount > 2800 ? '2800~3500' : Math.floor(oldWordCount * 1.3)}字之间，原文${oldWordCount}字${oldWordCount > 3500 ? '（超标精简模式：必须精简至3500字以内，删除冗余描写和重复段落）' : '（替换式修复字数应接近原文，仅补细节允许小幅增加）'}\n3. 禁止扩展情节、添加新场景，但允许在已有段落中补入感官细节\n4. 【critical】全知旁白→改为角色感知视角（通过角色看/听/感觉引入信息），绝对禁止上帝视角叙述\n5. 【critical】打破第四面墙→删除章回引用，改为"之前""早先""前几天"\n9. 只输出修改后的完整章节正文，不要输出任何其他内容\n${terminologyRule ? '\n' + terminologyRule + '\n' : ''}\n${perspectiveRule ? '\n' + perspectiveRule + '\n' : ''}`;
    return prompt;
}

function _extractContent(result) {
    if (result?.choices?.[0]?.message?.content) {
        const rawContent = result.choices[0].message.content;
        if (typeof rawContent === 'string') return rawContent;
        if (Array.isArray(rawContent)) return rawContent.filter(block => block.type === 'text' && block.text).map(block => block.text).join('\n');
        return String(rawContent || '');
    } else if (result?.response) return typeof result.response === 'string' ? result.response : String(result.response || '');
    else if (typeof result === 'string') return result;
    return null;
}

function _checkWordCount(newContent, oldWordCount, auditConfig) {
    const rejectMin = auditConfig.word.rejectMin;
    const maxWords = auditConfig.word.maxChapter;
    if (typeof newContent !== 'string') newContent = String(newContent || '');
    const newWordCount = newContent.replace(/\s/g, '').length;
    const isOverMax = oldWordCount > maxWords;
    const wordCountMinLimit = isOverMax ? Math.min(oldWordCount * 0.75, maxWords * 0.8) : oldWordCount * 0.75;
    if (newWordCount < wordCountMinLimit) return { pass: false, error: { success: false, error: `返修后字数${newWordCount}少于允许下限${Math.floor(wordCountMinLimit)}字` } };
    const wordCountIncreaseLimit = oldWordCount < rejectMin ? Math.max(oldWordCount * 1.3, rejectMin * 1.15) : Math.min(oldWordCount * 1.3, maxWords * 1.15);
    if (newWordCount > wordCountIncreaseLimit) return { pass: false, error: { success: false, error: `返修后字数${newWordCount}超出允许上限${Math.floor(wordCountIncreaseLimit)}字` } };
    if (newWordCount < rejectMin) return { pass: false, error: { success: false, error: `返修后字数${newWordCount}低于最低要求${rejectMin}字` } };
    if (newWordCount > maxWords * 1.15) {
        const truncResult = truncateChapter(newContent, Math.floor(maxWords * 1.15));
        return { pass: true, truncated: true, content: truncResult.content };
    }
    return { pass: true };
}

async function rollbackRepair(projectId, snapshotId) {
    const snapshot = await store.getItem('repair-snapshots', snapshotId);
    if (!snapshot) return { success: false, error: '快照不存在' };
    const chapter = await store.getItem('chapters', snapshot.chapterId);
    if (!chapter) return { success: false, error: '章节不存在' };
    chapter.content = snapshot.oldContent; chapter.normalContent = snapshot.oldNormalContent || snapshot.oldContent; chapter.polishedContent = snapshot.oldPolishedContent || snapshot.oldContent; chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', snapshot.chapterId, chapter);
    await auditChapter(projectId, null, null, null, snapshot.chapterId);
    return { success: true, chapterNumber: chapter.chapterNumber, restoredWordCount: snapshot.oldWordCount };
}

async function repairWithRetry(projectId, project, styleProfile, genre, genreLabel, chapterId, repairInstructions, llmService, pipelineService, options = {}) {
    const maxRetries = options.maxRetries || 10;
    const autoReview = options.autoReview !== false;
    const followUpPipeline = options.followUpPipeline !== false;
    const repairOpts = { provider: options.provider, model: options.model, autoReview };
    let lastResult = null;
    let attempt = 0;
    const attemptHistory = [];

    while (attempt < maxRetries) {
        attempt++;
        if (options.shouldCancel && options.shouldCancel()) { lastResult = lastResult || { success: false, error: '用户取消' }; lastResult.cancelled = true; lastResult.attempts = attempt - 1; break; }
        if (options.onProgress) options.onProgress({ phase: 'repair', attempt, chapterId, totalAttempts: maxRetries });
        lastResult = await repairChapter(projectId, project, styleProfile, genre, genreLabel, chapterId, repairInstructions, llmService, repairOpts);
        if (!lastResult.success) { attemptHistory.push({ attempt, phase: 'repair', success: false, error: lastResult.error, timestamp: new Date().toISOString() }); break; }

        const auditClean = lastResult.violationsAfter === 0;
        const hasCriticalViolation = (lastResult.remainingViolations || []).some(v => v.severity === 'critical');
        const reviewPassed = lastResult.reviewResults?.passed !== false;
        attemptHistory.push({ attempt, phase: 'repair+review', success: true, violationsBefore: lastResult.violationsBefore, violationsAfter: lastResult.violationsAfter, auditClean, reviewPassed, timestamp: new Date().toISOString() });

        if ((reviewPassed && !hasCriticalViolation) || (auditClean && reviewPassed)) { lastResult.allPassed = true; lastResult.attempts = attempt; break; }
        if (attempt >= maxRetries) { lastResult.maxRetriesReached = true; lastResult.allPassed = false; lastResult.attempts = attempt; break; }
        const newAudit = await auditChapter(projectId, project, styleProfile, genre, chapterId);
        if (newAudit.violations && newAudit.violations.length > 0) repairInstructions = newAudit.violations.map(v => v.desc).join('\n');
    }

    lastResult.attemptHistory = attemptHistory;
    if (lastResult.allPassed === undefined) lastResult.allPassed = false;
    if (!lastResult.attempts) lastResult.attempts = attempt;

    if (lastResult.allPassed && followUpPipeline && pipelineService) {
        try { lastResult.pipelineResult = await _runFollowUpPipeline(projectId, chapterId, pipelineService, project, options.onProgress); }
        catch (err) { lastResult.pipelineError = err.message; }
    }
    return lastResult;
}

module.exports = { repairChapter, rollbackRepair, repairWithRetry };
