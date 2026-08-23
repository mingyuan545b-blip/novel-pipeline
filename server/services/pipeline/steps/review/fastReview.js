const logger = require('../../../../shared/logger');
const { uuidv4, store, detectCharacterNameMismatch, resolveConfig, extractJSON, resolveGenreFromProject, getGenrePerspectiveSchema, getMetrics, reviewRemediation, getDataContext, truncateForReview, checkWordCountGate, loadReviewEntityData } = require('./reviewShared');
const { buildModuleHint } = require('../../../genres/moduleHintBuilder');
const { buildReviewerPovRuleSection } = require('../../povRuleSectionBuilder');
const { buildReviewerStyleRuleSection } = require('../../styleRuleSectionBuilder');

async function handleFastReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, mode, chapterId } = params;
    const ctx = await getDataContext(projectId);
    const _fastProj = await ctx.getProject();
    const _fastGenre = resolveGenreFromProject(_fastProj);
    const _fastAccess = _fastGenre?.agentMaterialAccess?.['fast-review'] || null;
    const _fastNeeds = _fastAccess ? new Set(_fastAccess.needs || []) : null;
    const _fastPerspectiveSchema = getGenrePerspectiveSchema(_fastGenre);
    const _fastPerspectiveField = _fastPerspectiveSchema.fields;
    const _fastConfig = resolveConfig(_fastGenre, _fastProj);
    const genreLabel = _fastGenre?.label || '题材';
    const fastReviewPrefix = `【任务】你是${genreLabel}快审员，只输出JSON审核结果，绝不输出小说正文。审核依据：实体中心角色状态+素材库设定，判断正文是否与已锁定设定一致。题材风格仅作参考，不得以风格偏好推翻已锁定设定：\n\n【正文（仅供审核）】\n系统实际字数：${chapter.wordCount || (chapter.content || '').length}字\n`;
    const _fastReviewInjection2 = reviewRemediation.getReviewPromptInjectionSync(_fastProj);

    let _entityCenterSection = '';
    let _foreshadowSection = '';
    let _fastConstraintsSection = '';
    try {
        const reviewData = await loadReviewEntityData('fast-review', projectId, chapter, ctx, _fastProj);
        _entityCenterSection = reviewData.entitySection;
        _foreshadowSection = reviewData.foreshadowSection;
        _knowledgeAccessSection = reviewData.knowledgeAccessSection || '';
        const constraintsText = reviewData.constraints?.text || '';
        if (constraintsText) {
            _fastConstraintsSection = `\n\n【行为约束（审核依据——检查正文是否违反行为规则）】\n${constraintsText}`;
        }
    } catch (_) { logger.warn('fastReview', _.message || _); }

    // 视角规则明确引用：避免审核员自行提高标准或脑补"第三人称限知"等未定义约束
    // 统一构建器：povRuleSectionBuilder.js，包含完整判定标准（违规示例+合规示例）
    // 解决审核员误判主观推断为上帝视角的问题
    const _fastPovSection = buildReviewerPovRuleSection(_fastProj);
    // SOP修复：注入完整风格规则（toneRule/dialogueRule/behaviorRule/titleRule），让快审员能看到题材核心约束
    const _fastStyleRuleSection = buildReviewerStyleRuleSection(_fastProj);

    // 模块功能提示：告诉快审员本章启用了哪些题材功能模块
    const _fastModuleHintSection = buildModuleHint(_fastGenre, 'fast-review');

    agentContext.content = `${fastReviewPrefix}\n\n${truncateForReview(chapter.content || '')}${_fastReviewInjection2}${_entityCenterSection}${_foreshadowSection}${_knowledgeAccessSection}${_fastConstraintsSection}${_fastPovSection}${_fastStyleRuleSection}${_fastModuleHintSection}\n\n【审核输出要求】issues中每个问题必须包含完整修改指导，让返修员能直接按指导修改。只有正文与实体中心/素材库设定严重矛盾，或存在逻辑硬伤才判未通过，小问题放入suggestions。不得以题材风格偏好推翻已锁定设定。\n\n【输出格式】先输出可读Markdown报告，末尾附JSON数据块：\n${'```'}json\n{"passed":true/false,"summary":"概述","issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_fastPerspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[{"title":"","description":"步骤"}]}\n${'```'}`;

    // 字数硬门禁：低于rejectMin直接拒绝，不进入LLM审核
    const wcBlocks = await checkWordCountGate(chapter.content, projectId);
    if (wcBlocks.length > 0) {
        logger.warn('fastReview', `fast-review HARD BLOCK: ${wcBlocks.map(b => b.title).join('; ')}`);
        const revIdWC = uuidv4();
        await store.setItem('reviews', revIdWC, { id: revIdWC, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'word-count-gate', result: { passed: false }, passed: false, content: wcBlocks.map(b => b.description).join('；'), issues: wcBlocks, suggestions: [], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
        return { step: 'fast-review', result: { response: '' }, passed: false, feedback: { passed: false, summary: `硬性检测拦截：${wcBlocks.map(b => b.title).join('；')}`, issues: wcBlocks, suggestions: [], _hardBlock: true }, chapter };
    }

    const result = await runAgent('fast-review', agentContext);
    chapter.firstReviewOutput = result.response;
    chapter.status = 'first-reviewing';
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    saveAgentOutput(projectId, chapter, 'fast-review', result.response);

    if (!result.response || result.response.trim().length === 0) {
        logger.warn('fastReview', 'fast-review returned empty response - defaulting to NOT passed');
        const revIdFEmpty = uuidv4();
        await store.setItem('reviews', revIdFEmpty, { id: revIdFEmpty, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: { passed: false, summary: '快审员返回空响应，默认未通过' }, passed: false, content: '快审员返回空响应，默认未通过', issues: [{ desc: '快审Agent返回空响应', severity: 'critical' }], suggestions: ['请检查LLM API配置'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
        return { step: 'fast-review', result, passed: false, roundFailed: true, feedbackPart: '【快审空响应】审核Agent未返回有效结果', chapter };
    }

    const parsed = _parseFastReviewResult(result, projectId, chapterId, round, chapter, ctx);
    if (parsed) return parsed;

    try { getMetrics(projectId).recordAgentPassRate('fast-review', true, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
    try { _checkCharacterNames(chapter, ctx); } catch(_) { logger.warn('fastReview', _.message || _); }

    let fastPassFeedback = { passed: true, summary: '快审通过', issues: [], suggestions: [] };
    try { const p = extractJSON(result.response); if (p) fastPassFeedback = { passed: true, summary: p.summary || '快审通过', issues: p.issues || [], suggestions: p.suggestions || [] }; } catch(_) { logger.warn('fastReview', _.message || _); }
    return { step: 'fast-review', result, passed: true, feedback: fastPassFeedback, chapter };
}

async function _parseFastReviewResult(result, projectId, chapterId, round, chapter, ctx) {
    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');
        const revIdFR = uuidv4();
        await store.setItem('reviews', revIdFR, { id: revIdFR, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: parsed, passed: !!parsed.passed, content: parsed.summary, issues: parsed.issues || [], suggestions: parsed.suggestions || [], round, createdAt: new Date().toISOString() });
        if (!parsed.passed) {
            const criticalIssues = (parsed.issues || []).filter(i => i.severity === 'critical');
            if (criticalIssues.length === 0 && round >= 2) {
                logger.info('fastReview', `fast-review round ${round}: no critical issues, auto-passing`);
                try { getMetrics(projectId).recordAgentPassRate('fast-review', true, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
                return { step: 'fast-review', result, passed: true, feedback: { passed: true, summary: `快审自动通过（R${round}无critical问题）`, issues: [], suggestions: parsed.suggestions || [] }, chapter };
            }
            try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'fast-review', result, passed: false, feedback: parsed, chapter };
        }
        // parsed.passed === true: return success result
        try { getMetrics(projectId).recordAgentPassRate('fast-review', true, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
        return { step: 'fast-review', result, passed: true, feedback: { passed: true, summary: parsed.summary || '快审通过', issues: parsed.issues || [], suggestions: parsed.suggestions || [] }, chapter };
    } catch (e) {
        logger.warn('fastReview', 'fast-review JSON parse failed, fallback to markdown');
        const text = result.response || '';
        const hasPipelineBlock = /\[PIPELINE_BLOCK:/.test(text);
        const hasCriticalIssues = hasPipelineBlock || /严重问题|设定矛盾|逻辑错误|重大缺陷/.test(text);
        const fallbackPassed = !hasCriticalIssues;
        const fallbackFeedback = { passed: fallbackPassed, summary: hasPipelineBlock ? '快审发现阻断问题' : (hasCriticalIssues ? '快审发现严重问题（Markdown格式）' : '快审通过（Markdown格式）'), issues: hasCriticalIssues ? [{ description: hasPipelineBlock ? text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || '阻断问题' : '审核返回Markdown格式，检测到严重问题', severity: 'high' }] : [], suggestions: [] };
        const revIdFRfb = uuidv4();
        await store.setItem('reviews', revIdFRfb, { id: revIdFRfb, chapterId, projectId, step: 'fast-review', type: 'fast-review', reviewer: 'fast-review-agent', result: fallbackFeedback, passed: fallbackPassed, content: fallbackFeedback.summary, issues: fallbackFeedback.issues, suggestions: [], round, createdAt: new Date().toISOString() });
        if (!fallbackPassed) {
            try { getMetrics(projectId).recordAgentPassRate('fast-review', false, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            return { step: 'fast-review', result, passed: false, feedback: fallbackFeedback, chapter };
        }
        // fallbackPassed === true: markdown review passed
        try { getMetrics(projectId).recordAgentPassRate('fast-review', true, chapter.chapterNumber); } catch(_) { logger.warn('fastReview', _.message || _); }
        return { step: 'fast-review', result, passed: true, feedback: fallbackFeedback, chapter };
    }
}

async function _checkCharacterNames(chapter, ctx) {
    const _frCharMats = await ctx.getCharacterMaterials();
    const _frCharNames = _frCharMats.filter(m => !m.archived).map(m => m.name).filter(Boolean);
    if (_frCharNames.length > 0) {
        const _frNameResult = detectCharacterNameMismatch(chapter.content || '', _frCharNames);
        if (_frNameResult.unknownNames.length > 0) {
            const unknownDetail = _frNameResult.unknownNames.slice(0, 5).map(n => `"${n.name}"(出现${n.count}次)`).join('、');
            logger.warn('fastReview', `fast-review name-check warning: 可能有未知角色名 ${unknownDetail} — 不再硬性拦截`);
        }
    }
}

module.exports = { handleFastReview };
