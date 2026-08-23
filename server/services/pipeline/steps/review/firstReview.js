/**
 * firstReview - 初审步骤
 *
 * 职责：构建审核上下文 + 调用LLM + 硬性检测 + 返回结果
 * 解析/保存/fallback/constraints逻辑拆分到 firstReviewParser.js
 * 软硬分离共享逻辑在 reviewSoftHardSeparator.js
 */
const logger = require('../../../../shared/logger');
const { uuidv4, store, resolveGenreFromProject, getGenrePerspectiveSchema, reviewRemediation, getMetrics, getDataContext, truncateForReview, loadReviewEntityData } = require('./reviewShared');
const { collectWritingTechniqueHints, runHardBlockChecks } = require('./firstReviewChecks');
const { buildModuleHint } = require('../../../genres/moduleHintBuilder');
const { buildReviewerPovRuleSection } = require('../../povRuleSectionBuilder');
const { buildReviewerStyleRuleSection } = require('../../styleRuleSectionBuilder');
const { parseAndSaveReview, buildWriterConstraints } = require('./firstReviewParser');

async function handleFirstReview(params) {
    const { projectId, chapter, agentContext, runAgent, saveAgentOutput, round, chapterId } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();

    // 1. Collect writing technique hints
    const writingTechniqueHints = await collectWritingTechniqueHints(chapter, ctx, project);

    // 2. Build review context
    const _frGenre = resolveGenreFromProject(project);
    const _frPerspectiveSchema = getGenrePerspectiveSchema(_frGenre);
    const _reviewInjection = reviewRemediation.getReviewPromptInjectionSync(project);

    let _frEntitySection = '', _frForeshadowSection = '', _frKnowledgeAccessSection = '', _frConstraintsSection = '';
    try {
        const reviewData = await loadReviewEntityData('first-review', projectId, chapter, ctx, project);
        _frEntitySection = reviewData.entitySection;
        _frForeshadowSection = reviewData.foreshadowSection;
        _frKnowledgeAccessSection = reviewData.knowledgeAccessSection || '';
        const constraintsText = reviewData.constraints?.text || '';
        if (constraintsText) {
            _frConstraintsSection = `\n\n【行为约束（审核依据——检查正文是否违反行为规则）】\n${constraintsText}`;
        }
    } catch (e) { logger.warn('firstReview', e.message || e); }

    // 意图规划约束：审核员必须知道Must Keep/Avoid，避免误判
    const _intentSection = agentContext.chapterIntent
        ? `\n\n【意图规划约束（必须遵守）】\n以下为意图管理员为本章设定的写作约束，审核时必须以此为依据：\n${agentContext.chapterIntent}\n注意：如果正文遵循了上述Must Avoid约束（如"禁止当场揭穿"），不得判定为OOC或行为不当。`
        : '';

    // 视角规则明确引用：避免审核员自行提高标准或脑补"第三人称限知"等未定义约束
    const _frPovSection = buildReviewerPovRuleSection(project);
    const _frStyleRuleSection = buildReviewerStyleRuleSection(project);

    // 断点2修复：补4种创作约束，让审核标准与创作约束一致
    const _writerConstraintsSection = await buildWriterConstraints(ctx, projectId, chapter, project);

    // 模块功能提示：告诉审核员本章启用了哪些题材功能模块
    const _moduleHintSection = buildModuleHint(_frGenre, 'first-review');

    agentContext.content = `【任务】你是初审员，审核依据：实体中心角色状态+素材库设定+意图规划约束+视角规则，判断正文是否与已锁定设定一致。题材风格仅作参考，不得以风格偏好推翻已锁定设定。绝不输出小说正文。\n\n【正文（仅供审核）】\n系统实际字数：${chapter.wordCount || (chapter.content || '').length}字\n${truncateForReview(chapter.content || '')}${_reviewInjection}${writingTechniqueHints}${_frEntitySection}${_frForeshadowSection}${_frKnowledgeAccessSection}${_frConstraintsSection}${_frPovSection}${_frStyleRuleSection}${_intentSection}${_writerConstraintsSection}${_moduleHintSection}\n\n【审核输出要求 - 极其重要】\n1. 只有以下情况才能判未通过（passed=false）：\n   - 正文与实体中心/素材库设定严重矛盾\n   - 存在逻辑硬伤（时间线矛盾/角色崩坏/战力崩坏）\n   - 真正的视角违规（作者以全知视角直接陈述NPC心理——注意：主角自己的回忆/感受/独白是合规的，主角对NPC的主观推测也是合规的，不得误判）\n   - 题材核心约束完全缺失（如toneRule明确要求"每章至少N处笑点"但正文零笑点——这是critical硬伤，不是风格偏好）\n2. 以下情况不得判未通过，不得放入issues，只能放入suggestions：\n   - 非核心的风格偏好问题（如笑点数量不足但非零、节奏偏慢/环境描写偏多、文风偏文青/AI痕迹、系统交互叙事融入不足）\n   - 注意：如果toneRule把某项列为"核心卖点/硬指标"（如"每章至少3处笑点"），则该项完全缺失（零笑点）属于critical硬伤，不受此条限制\n3. 不得以题材风格偏好推翻已锁定设定。遵循意图规划Must Avoid的行为不算OOC。\n4. 误把主角自己的心理/回忆/感受判为视角违规，属于严重审核失误。\n\n【输出格式 - 极其重要】\n先输出可读的Markdown审核报告，再在末尾附上JSON数据块（系统需要解析JSON）。\n\nMarkdown报告格式：\n## 初审结果：✅通过 / ❌未通过\n**审核概要**：一句话总结\n### 问题列表\n1. **[critical] 问题类型** - 位置：第X段\n   - 原文："..."\n   - ${_frPerspectiveSchema.fields}\n   - 违规原因：...\n   - 修改建议：...\n   - 改写为："..."\n### 建议\n- ...\n\n末尾附上JSON数据块：\n${'```'}json\n{"passed":true/false,"summary":"拒绝/通过原因概述","issues":[{"title":"问题类型","location":"问题所在位置","originalText":"原文语句",${_frPerspectiveSchema.fields},"violationReason":"违反了什么规则","howToFix":"具体怎么改","targetText":"改写后的完整句子","severity":"critical/high/medium"}],"suggestions":[{"title":"建议标题","description":"具体操作步骤"}]}\n${'```'}`;

    // 3. Run LLM agent
    const result = await runAgent('first-review', agentContext);
    chapter.firstReviewOutput = result.response;
    chapter.status = 'first-reviewing';
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    logger.debug('firstReview', `After store.setItem: firstReviewOutput=${chapter.firstReviewOutput ? 'YES('+chapter.firstReviewOutput.length+'chars)' : 'NULL'}, chapterId=${chapterId}`);
    saveAgentOutput(projectId, chapter, 'first-review', result.response);

    // 4. Handle empty response
    if (!result.response || result.response.trim().length === 0) {
        logger.warn('firstReview', 'first-review returned empty response - defaulting to NOT passed');
        const revId = uuidv4();
        await store.setItem('reviews', revId, { id: revId, chapterId, projectId, step: 'first-review', type: 'first-review', reviewer: 'first-review-agent', result: { passed: false, summary: '审核员返回空响应，默认未通过（安全策略）' }, passed: false, content: '审核员返回空响应，默认未通过', issues: [{ desc: '审核Agent返回空响应', severity: 'critical' }], suggestions: ['请检查LLM API配置'], round, createdAt: new Date().toISOString() });
        try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch (e) { logger.warn('firstReview', e.message || e); }
        return { step: 'first-review', result, passed: false, roundFailed: true, feedbackPart: '【初审空响应】审核Agent未返回有效结果', chapter };
    }

    // 5. Parse result and handle pass/fail（拆分到firstReviewParser.js）
    const parseResult = await parseAndSaveReview(result, chapter, chapterId, projectId, round, ctx);
    if (parseResult) return parseResult;

    // 6. Hard block checks after LLM pass
    const { hardBlockIssues, warningIssues } = await runHardBlockChecks(chapter, ctx, projectId);
    if (hardBlockIssues.length > 0) {
        logger.warn('firstReview', `HARD BLOCK: ${hardBlockIssues.map(i => i.title).join('; ')}`);
        try { getMetrics(projectId).recordAgentPassRate('first-review', false, chapter.chapterNumber); } catch (e) { logger.warn('firstReview', e.message || e); }
        chapter.updatedAt = new Date().toISOString(); await store.setItem('chapters', chapterId, chapter);
        return { step: 'first-review', result, passed: false, feedback: { passed: false, summary: `硬性检测拦截：${hardBlockIssues.map(i => i.title).join('；')}`, issues: [...hardBlockIssues, ...warningIssues], suggestions: hardBlockIssues.map(i => ({ description: i.description })), _hardBlock: true }, chapter };
    } else if (warningIssues.length > 0) { logger.warn('firstReview', `SOFT WARNING: ${warningIssues.map(i => i.title).join('; ')} — not blocking`); }

    // 7. Pass
    try { getMetrics(projectId).recordAgentPassRate('first-review', true, chapter.chapterNumber); } catch (e) { logger.warn('firstReview', e.message || e); }
    let passFeedback = { passed: true, summary: '初审通过', issues: [], suggestions: [] };
    try { const parsed = require('./reviewShared').extractJSON(result.response); if (parsed) passFeedback = { passed: true, summary: parsed.summary || '初审通过', issues: parsed.issues || [], suggestions: parsed.suggestions || [] }; } catch (e) { logger.warn('firstReview', e.message || e); }
    return { step: 'first-review', result, passed: true, feedback: passFeedback, chapter };
}

module.exports = { handleFirstReview };
