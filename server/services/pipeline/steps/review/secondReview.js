/**
 * secondReview - 复审步骤
 *
 * 职责：构建复审上下文 + 字数硬门禁 + 调用LLM + 后置硬性检测 + 返回结果
 * 解析/保存/fallback逻辑拆分到 secondReviewParser.js
 * 软硬分离共享逻辑在 reviewSoftHardSeparator.js
 */
const logger = require('../../../../shared/logger');
const { uuidv4, store, resolveConfig, extractJSON, resolveGenreFromProject, getGenrePerspectiveSchema, runGenreSecondReviewIntercept, getMetrics, reviewRemediation, getDataContext, truncateForReview, truncateReviewOutput, checkWordCountGate, loadReviewEntityData } = require('./reviewShared');
const { buildModuleHint } = require('../../../genres/moduleHintBuilder');
const { buildReviewerPovRuleSection } = require('../../povRuleSectionBuilder');
const { buildReviewerStyleRuleSection } = require('../../styleRuleSectionBuilder');
const { parseSecondReviewResult } = require('./secondReviewParser');

async function handleSecondReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, chapterId } = params;
    const ctx = await getDataContext(projectId);

    let secondReviewStyleCheck = '';
    const proj2 = await ctx.getProject();
    if (proj2?.styleTemplateId) {
        const st2 = await ctx.getStyleTemplate();
        if (st2) {
            const rulesStr = Object.entries(st2.rules || {}).filter(([k, v]) => k !== 'forbidden' && v).map(([k, v]) => `${k}:${v}`).join('|');
            const forbiddenStr = (st2.rules?.forbidden || []).length ? `禁止:${st2.rules.forbidden.join('/')}` : '';
            if (rulesStr || forbiddenStr) secondReviewStyleCheck = `\n【风格审核${st2.name}】${rulesStr}${forbiddenStr ? '|' + forbiddenStr : ''} styleScore(1-10)`;
            else if (st2.example) secondReviewStyleCheck = `\n【风格参考审核${st2.name}】正文风格是否与参考文本一致？styleScore(1-10) 参考风格：${st2.example.substring(0, 1000)}`;
        }
    }

    const _srGenre = resolveGenreFromProject(proj2);
    const _srPerspectiveSchema = getGenrePerspectiveSchema(_srGenre);
    const _srPerspectiveField = _srPerspectiveSchema.fields;
    const _srReviewInjection2 = reviewRemediation.getReviewPromptInjectionSync(proj2);

    let _srEntitySection = '', _srKnowledgeAccessSection = '', _srConstraintsSection = '';
    try {
        const reviewData = await loadReviewEntityData('second-review', projectId, chapter, ctx, proj2);
        _srEntitySection = reviewData.entitySection;
        _srKnowledgeAccessSection = reviewData.knowledgeAccessSection || '';
        const constraintsText = reviewData.constraints?.text || '';
        if (constraintsText) {
            _srConstraintsSection = `\n\n【行为约束（审核依据——检查正文是否违反行为规则）】\n${constraintsText}`;
        }
    } catch (_) { logger.warn('secondReview', _.message || _); }  // DEGRADE: 影响=loadReviewEntityData 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // 意图规划约束：复审员必须知道Must Keep/Avoid，避免误判
    const _intentSection = agentContext.chapterIntent
        ? `\n\n【意图规划约束（必须遵守）】\n以下为意图管理员为本章设定的写作约束，复审时必须以此为依据：\n${agentContext.chapterIntent}\n注意：如果正文遵循了上述Must Avoid约束（如"禁止当场揭穿"），不得判定为OOC或行为不当。`
        : '';

    const _srPovSection = buildReviewerPovRuleSection(proj2);
    const _srStyleRuleSection = buildReviewerStyleRuleSection(proj2);
    const _srModuleHintSection = buildModuleHint(_srGenre, 'second-review');

    agentContext.content = `【任务】你是复审员，请复审，绝不输出小说正文。审核依据：实体中心角色状态+素材库设定+意图规划约束+视角规则，判断正文是否与已锁定设定一致。\n\n【正文（仅供审核）】\n系统实际字数：${chapter.wordCount || (chapter.content || '').length}字\n${truncateForReview(chapter.content || '')}\n\n【初审结果】\n${truncateReviewOutput(chapter.firstReviewOutput || '')}${secondReviewStyleCheck}${_srReviewInjection2}${_srEntitySection}${_srKnowledgeAccessSection}${_srConstraintsSection}${_srPovSection}${_srStyleRuleSection}${_intentSection}${_srModuleHintSection}\n\n【审核输出要求 - 极其重要】\n1. 复审判定标准必须与初审完全一致，不得提高标准或自行脑补"第三人称限知"等未定义约束。初审已通过的内容，复审不得以相同理由重新判违规（除非初审明显遗漏了Critical级硬伤）。\n2. 只有以下情况才能判未通过（passed=false）：\n   - 正文与实体中心/素材库设定严重矛盾\n   - 存在逻辑硬伤（时间线矛盾/角色崩坏/战力崩坏）\n   - 真正的视角违规（作者以全知视角直接陈述NPC心理——注意：主角自己的回忆/感受/独白是合规的，主角对NPC的主观推测也是合规的，不得误判）\n   - 题材核心约束完全缺失（如toneRule明确要求"每章至少N处笑点"但正文零笑点——这是critical硬伤，不是风格偏好）\n3. 以下情况不得判未通过，不得放入issues，只能放入suggestions：\n   - 非核心的风格偏好问题（如笑点数量不足但非零、节奏偏慢/环境描写偏多、文风偏文青/AI痕迹、系统交互叙事融入不足）\n   - 注意：如果toneRule把某项列为"核心卖点/硬指标"（如"每章至少3处笑点"），则该项完全缺失（零笑点）属于critical硬伤，不受此条限制\n4. 误把主角自己的心理/回忆/感受判为视角违规，属于严重审核失误。\n5. 误把主角对NPC的主观推测判为上帝视角，属于严重审核失误。\n6. 不得因为初审通过了就刻意找问题来证明复审的价值。复审的职责是查漏补缺，不是推翻初审。\n\n【输出格式】先输出可读Markdown报告，末尾附JSON数据块：\n${'```'}json\n{"passed":true/false,"issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_srPerspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[],"summary":"概述","styleScore":1-10}\n${'```'}`;

    // 字数硬门禁
    const srWcBlocks = await checkWordCountGate(chapter.content, projectId);
    if (srWcBlocks.length > 0) {
        logger.warn('secondReview', `second-review HARD BLOCK: ${srWcBlocks.map(b => b.title).join('; ')}`);
        const revIdSRWC = uuidv4();
        await store.setItem('reviews', revIdSRWC, { id: revIdSRWC, chapterId, projectId, step: 'second-review', type: 'second-review', reviewer: 'word-count-gate', result: { passed: false }, passed: false, content: srWcBlocks.map(b => b.description).join('；'), issues: srWcBlocks, suggestions: [], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch (_) { logger.warn('secondReview', _.message || _); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        return { step: 'second-review', result: { response: '' }, passed: false, feedback: { passed: false, summary: `硬性检测拦截：${srWcBlocks.map(b => b.title).join('；')}`, issues: srWcBlocks, suggestions: [], _hardBlock: true }, chapter };
    }

    const result = await runAgent('second-review', agentContext);
    chapter.secondReviewOutput = result.response;
    chapter.status = 'second-reviewing';
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    saveAgentOutput(projectId, chapter, 'second-review', result.response);

    if (!result.response || result.response.trim().length === 0) {
        logger.warn('secondReview', 'second-review returned empty response - defaulting to NOT passed');
        const revId2Empty = uuidv4();
        await store.setItem('reviews', revId2Empty, { id: revId2Empty, chapterId, projectId, step: 'second-review', type: 'second-review', reviewer: 'second-review-agent', result: { passed: false, summary: '复审员返回空响应，默认未通过' }, passed: false, content: '复审员返回空响应，默认未通过', issues: [{ desc: '复审Agent返回空响应', severity: 'critical' }], suggestions: ['请检查LLM API配置'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('second-review', false, chapter.chapterNumber); } catch (_) { logger.warn('secondReview', _.message || _); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        return { step: 'second-review', result, passed: false, roundFailed: true, feedbackPart: '【复审空响应】审核Agent未返回有效结果', chapter };
    }

    // 解析结果（拆分到secondReviewParser.js）
    const parsed = await parseSecondReviewResult(result, projectId, chapterId, round, chapter);
    if (parsed) return parsed;

    try { getMetrics(projectId).recordAgentPassRate('second-review', true, chapter.chapterNumber); } catch (_) { logger.warn('secondReview', _.message || _); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    // Post-pass hard block checks
    try {
        const _srContent = chapter.content || '';
        const _srProj = await ctx.getProject();
        const _srStyleProfile = _srProj?.styleProfile;
        const genreSecondIntercept = runGenreSecondReviewIntercept(_srContent, _srStyleProfile, { scene: chapter.scene, outline: chapter.outline });
        if (genreSecondIntercept.hardBlockIssues?.length > 0) {
            const _srIssue = genreSecondIntercept.hardBlockIssues[0];
            logger.warn('secondReview', `second-review passed but genre HARD BLOCK: ${_srIssue.title}`);
            return { step: 'second-review', result, passed: false, feedback: { passed: false, summary: _srIssue.description, issues: [{ title: _srIssue.title + '(系统HARD BLOCK)', description: _srIssue.description, severity: 'critical' }], suggestions: [{ title: _srIssue.title, description: _srIssue.description }] }, chapter };
        }
        const _srWc = _srContent.replace(/\s/g, '').length;
        const _srMaxWords = (_srProj?.wordConfig || {}).maxWords || (resolveConfig(resolveGenreFromProject(_srProj), _srProj)).word.maxChapter;
        if (_srWc > _srMaxWords) {
            logger.warn('secondReview', `second-review passed but word count HARD BLOCK: ${_srWc} > ${_srMaxWords}`);
            return { step: 'second-review', result, passed: false, feedback: { passed: false, summary: `字数超标：${_srWc}字超出上限${_srMaxWords}字，必须精简`, issues: [{ title: '字数超标(系统HARD BLOCK)', description: `当前${_srWc}字 > 上限${_srMaxWords}字`, severity: 'critical' }], suggestions: [{ title: '精简内容', description: '删除冗余描写、合并重复段落、精简过渡句' }] }, chapter };
        }
    } catch (_srErr) { logger.warn('secondReview', 'second-review HARD BLOCK check failed:', _srErr.message); }  // DEGRADE: 影响=二审核查 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    let secondPassFeedback = { passed: true, summary: '复审通过', issues: [], suggestions: [] };
    try { const p = extractJSON(result.response); if (p) secondPassFeedback = { passed: true, summary: p.summary || '复审通过', issues: p.issues || [], suggestions: p.suggestions || [] }; } catch (_) { logger.warn('secondReview', _.message || _); }  // DEGRADE: 影响=extractJSON 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return { step: 'second-review', result, passed: true, feedback: secondPassFeedback, chapter };
}

module.exports = { handleSecondReview };
