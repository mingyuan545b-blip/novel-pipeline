const logger = require('../../shared/logger');
const store = require('../../store');
const { getStyleProfileForProject } = require('../agentPrompts');
const { getGenreReviewRules, getGenrePerspectiveSchema } = require('../genreConfig');
const { _getDefaultRepairConfig, _buildApiConfig } = require('./helpers');
const { _runHardBlockChecks, _buildTechniqueHints } = require('./hardBlockChecks');

async function reviewChapter(projectId, project, styleProfile, genre, genreLabel, chapterId, llmService, apiConfig) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return { error: '章节不存在' };
    const content = chapter.content || '';
    const wordCount = content.replace(/\s/g, '').length;
    const reviewConfig = apiConfig || _getDefaultRepairConfig(project, project?.agentModelConfig);
    const _reviewRules = getGenreReviewRules(genre);
    const _perspectiveRule = _reviewRules?.firstReview?.perspectiveRule || '';
    const _terminologyRule = _reviewRules?.firstReview?.terminologyRule || '';
    const _outputRule = _reviewRules?.firstReview?.outputRule || '';
    const _perspectiveSchema = getGenrePerspectiveSchema(genre);
    const _perspectiveField = _perspectiveSchema.fields;
    const _perspectiveLabel = _perspectiveSchema.label;

    const _genreSpecificChecks = genre?.id === 'baby'
        ? `3. 【critical】系统机制直述/幼崽视角术语未降维（管线元数据泄露、专业术语出现在幼崽视角段落）\n4. 【critical】视角越界（成人化描写、混合视角、幼崽成人化内心独白）\n5. 网络用语/网文腔\n6. 拟声词不足\n7. 母子对话缺失`
        : `3. 【critical】系统机制直述/管线元数据泄露\n4. 【critical】视角越界（上帝视角、全知旁白）\n5. 网络用语/网文腔`;

    const techniqueHints = await _buildTechniqueHints(content, styleProfile, projectId, store);
    const reviewPrompt = `你是小说初审复审员。请审核以下章节内容，检查是否存在以下问题：
1. 【critical】全知旁白（信息未通过角色感官自然过渡，上帝视角叙述）
2. 【critical】打破第四面墙（章回引用、元叙事）
${_genreSpecificChecks}

【章节信息】第${chapter.chapterNumber}章 "${chapter.title}" (${wordCount}字)

${techniqueHints}
${_perspectiveRule ? '\n' + _perspectiveRule + '\n' : ''}${_terminologyRule ? '\n' + _terminologyRule + '\n' : ''}${_outputRule ? '\n' + _outputRule + '\n' : ''}
【审核输出要求 - 极其重要】
先输出可读的Markdown审核报告，末尾附JSON数据块。

Markdown报告格式：
## 审核结果：✅通过 / ❌未通过
**审核概要**：一句话总结
### 问题列表
1. **[critical] 问题类型** - 位置：第X段
   - 原文："..."
   - ${_perspectiveLabel}
   - 违规原因：...
   - 修改建议：...
   - 改写为："..."
### 建议
- ...

末尾附JSON数据块：
\`\`\`json
{"passed":true/false,"summary":"概述","issues":[{"title":"问题类型","location":"位置","originalText":"原文",${_perspectiveField},"violationReason":"违规原因","howToFix":"修改方法","targetText":"改写后","severity":"critical/high/medium"}],"suggestions":[{"title":"标题","description":"步骤"}]}
\`\`\`

issues中每个问题必须包含完整修改指导，让返修员能直接按指导修改，无需猜测。`;

    try {
        logger.info('reviewMethods', `[AUDITOR] Review Ch${chapter.chapterNumber} using ${reviewConfig.provider}/${reviewConfig.model}`);
        const _systemPrompt = genre?.id === 'baby'
            ? '你是专业小说审核编辑。严格按幼崽视角规则审核，先输出可读Markdown报告，末尾附JSON数据块，绝不输出小说正文。'
            : `你是专业小说审核编辑。严格按${genreLabel}题材规则审核，先输出可读Markdown报告，末尾附JSON数据块，绝不输出小说正文。`;
        const messages = [
            { role: 'system', content: _systemPrompt },
            { role: 'user', content: reviewPrompt + '\n\n【章节正文】\n' + content.substring(0, 8000) }
        ];
        const result = await llmService.chat(messages, { maxTokens: 8192, apiConfig: reviewConfig });
        const usedModel = result?.model || reviewConfig.model || 'unknown';
        const usedProvider = reviewConfig.provider || 'unknown';

        let reviewContent = '';
        if (result?.choices?.[0]?.message?.content) {
            const rawContent = result.choices[0].message.content;
            if (typeof rawContent === 'string') reviewContent = rawContent;
            else if (Array.isArray(rawContent)) reviewContent = rawContent.filter(block => block.type === 'text' && block.text).map(block => block.text).join('\n');
            else reviewContent = String(rawContent || '');
        } else if (typeof result === 'string') reviewContent = result;

        let parsed = null;
        try { const jsonMatch = reviewContent.match(/\{[\s\S]*\}/); if (jsonMatch) parsed = JSON.parse(jsonMatch[0]); } catch (_) { logger.warn('reviewMethods', '[review-methods]', _.message || _); }  // DEGRADE: 影响=reviewContent.match 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

        if (parsed) {
            const hardBlockResult = await _runHardBlockChecks(content, styleProfile, project, projectId, store);
            const hardBlockIssues = hardBlockResult.issues.map(issue => ({ title: '硬性检测拦截', description: issue, severity: 'critical' }));
            return { passed: !!parsed.passed && !hardBlockResult.blocked, summary: parsed.summary || '', issues: [...(parsed.issues || []), ...hardBlockIssues], suggestions: parsed.suggestions || [], reviewContent, usedModel, usedProvider, wordCount, chapterNumber: chapter.chapterNumber };
        }
        const passed = reviewContent.includes('通过') && !reviewContent.includes('未通过');
        return { passed, summary: passed ? '审核通过' : '审核未通过', issues: passed ? [] : [{ title: '审核未通过', description: reviewContent.substring(0, 500), severity: 'high' }], suggestions: [], reviewContent, usedModel, usedProvider, wordCount, chapterNumber: chapter.chapterNumber };
    } catch (err) {
        logger.error('reviewMethods', '[CHAPTER_AUDITOR] Review error:', err);
        return { error: err.message, passed: false, issues: [], suggestions: [] };
    }
}

module.exports = { reviewChapter };
