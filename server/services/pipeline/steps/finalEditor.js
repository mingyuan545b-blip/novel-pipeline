const { v4: uuidv4 } = require('uuid');
const logger = require('../../../shared/logger');
const store = require('../../../store');
const { extractJSON } = require('../../jsonUtils');
const { cleanFinalContent, truncateChapter, detectTellVerbs, extractEndingTension } = require('../../contentUtils');
const { getStyleProfileForProject } = require('../../agentPrompts');
const { resolveGenreFromProject, getGenreReviewRules } = require('../../genreConfig');
const { buildModuleHint } = require('../../genres/moduleHintBuilder');
const { buildReviewerPovRuleSection } = require('../povRuleSectionBuilder');
const reviewRemediation = require('../../reviewRemediation');
const { getMetrics } = require('../../metricsCollector');
const { saveAgentOutput, saveFinalContent } = require('../../fileOutput');
const { NOVEL_DEFAULTS } = require('../../../config/genreDefaults');
const { assembleMaterialState } = require('../materialStateAssembler');
const { injectMaterials, buildCharacterByFormat } = require('../materialInjector');
const { saveTimelineEvent } = require('../../timelineAdapter');
const { mergeWithArchivedForeshadows } = require('./foreshadowArchiveLoader');
const { STATUS_VALUES } = require('../../chapterStatus');
const { getDataContext } = require('../../dataContext');

/** 处理定稿通过：更新chapter状态、字数、quest */
async function handleApprovedChapter({ chapter, chapterId, projectId, parsed, modeConfig, ctx }) {
    if (!ctx) throw new Error('handleApprovedChapter requires ctx (DataContext)');
    try { getMetrics(projectId).recordAgentPassRate('final-editor', true, chapter.chapterNumber); } catch (_) { logger.warn('finalEditor', _.message || _); }
    const endingCheck = extractEndingTension(chapter.content || '');
    if (!endingCheck.hasTension) {
        if (!parsed.edits) parsed.edits = [];
        parsed.edits.push({ priority: 'medium', description: '章节收尾缺乏张力点', type: 'ending-tension' });
    }
    const tellCheck = detectTellVerbs(chapter.content || '');
    if (tellCheck.count > 3) logger.warn('finalEditor', `Tell-verb density high: ${tellCheck.count}`);
    chapter.status = STATUS_VALUES.APPROVED;
    chapter.content = cleanFinalContent(chapter.content || '');
    chapter.wordCount = chapter.content.replace(/\s/g, '').length;
    const feProject = await ctx.getProject();
    const feMaxWords = (feProject?.wordConfig || {}).maxWords || modeConfig?.word?.maxChapter || NOVEL_DEFAULTS.maxChapterWords;
    if (chapter.wordCount > feMaxWords) {
        chapter.content = truncateChapter(chapter.content, feMaxWords).content;
        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
    }
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    saveFinalContent(projectId, chapter);
}

/** 保存review记录并处理quest/timeline */
async function saveFinalEditorReview({ projectId, chapterId, chapter, parsed, round, ctx }) {
    if (!ctx) throw new Error('saveFinalEditorReview requires ctx (DataContext)');
    const revId = uuidv4();
    await store.setItem('reviews', revId, {
        id: revId, chapterId, projectId, step: 'final-editor', type: 'final-editor',
        reviewer: 'final-editor-agent', result: parsed, passed: !!parsed.approved,
        content: parsed.summary || parsed.scheduleNote || '', issues: parsed.edits || [],
        suggestions: parsed.suggestions || [], round, createdAt: new Date().toISOString()
    });
    // 通过DataContext读取quests（遵守PROJECT_STANDARDS第9条）
    const allQuests = await ctx.getQuests();
    const relatedQuests = allQuests.filter(q => (q.chapterIds || []).includes(chapterId));
    if (relatedQuests.length > 0) {
        const quest = relatedQuests[0];
        await store.setItem('quests', quest.id, { ...quest, status: parsed.approved ? 'completed' : 'active', progress: parsed.approved ? 100 : quest.progress, ...(parsed.approved ? { completedAt: new Date().toISOString() } : {}), updatedAt: new Date().toISOString() });
    }
    if (parsed.ipDirection) {
        // 通过DataContext读取timelines（遵守PROJECT_STANDARDS第9条）
        const existingTimelines = await ctx.getTimelines();
        const tlId = uuidv4();
        // 统一写入 timeline-events 表（SOP: 时间轴数据源统一，禁止写 timelines 表）
        await saveTimelineEvent(projectId, {
            id: tlId, projectId, title: `第${chapter.chapterNumber}章IP方向`,
            description: typeof parsed.ipDirection === 'string' ? parsed.ipDirection.substring(0, 500) : JSON.stringify(parsed.ipDirection).substring(0, 500),
            eventType: 'revelation', storyOrder: existingTimelines.length, sortOrder: existingTimelines.length,
            storyTime: `第${chapter.chapterNumber}章`, chapterIds: [chapterId], questIds: relatedQuests.map(q => q.id),
            materialIds: [], characterIds: [], location: '', importance: 'high', isKeyEvent: true,
            notes: '', tags: ['auto-generated', 'ip-direction'], createdAt: new Date().toISOString()
        });
    }
}

/** Markdown fallback解析 */
function parseFallbackApproval(text) {
    const hasPipelineBlock = /\[PIPELINE_BLOCK:/.test(text);
    // 审核意见特征：含标题、判定结果、json代码块等标记，不应误判为小说正文
    const hasReviewMarker = /定稿|审核|判定|意见|结论|裁定|approved|rejected|```json/i.test(text);
    // 小说正文特征：长文本且无审核标记、无JSON块、无大括号
    const isNovelContent = text.length > 500 && !hasPipelineBlock && !hasReviewMarker && !/\{[\s\S]*\}/.test(text);
    let approved = false;
    if (hasPipelineBlock) approved = false;
    else if (isNovelContent) approved = false;
    else {
        const hasApproval = /通过|批准|approved|✅|合格|达标|准予/.test(text);
        const hasRejection = /不通过|拒绝|rejected|❌|驳回/.test(text);
        const hasCriticalIssue = /严重|矛盾|逻辑错误|人设崩塌|视角混乱|critical/.test(text);
        if (hasCriticalIssue) approved = false;
        else if (hasApproval && !hasRejection) approved = true;
        else if (hasApproval && hasRejection) approved = /进度追踪|合作约定|断章.*格式|格式.*模块|缺失.*模块/.test(text);
    }
    return { approved, hasPipelineBlock, isNovelContent };
}

async function handleFinalEditor({ projectId, chapter, chapterId, agentContext, runAgent, round, modeConfig, materials, project }) {
    const ctx = await getDataContext(projectId);
    const _feProject = await ctx.getProject();
    const _feReviewRules = getGenreReviewRules(resolveGenreFromProject(_feProject));
    // 视角规则来源统一：优先使用styleProfile.povRule（与执笔/审核员一致），fallback到reviewRules
    // 根因修复：原代码只从getGenreReviewRules获取，甜宠题材无reviewRules导致perspectiveRule为空
    // 统一构建器：povRuleSectionBuilder.js，包含完整判定标准（违规示例+合规示例）
    const _feStyleProfile = _feProject?.styleProfile || {};
    let _fePovSection = '';
    if (_feStyleProfile.povRule) {
        // 主路径：使用统一构建器（含判定标准）
        _fePovSection = buildReviewerPovRuleSection(_feProject);
    } else if (_feReviewRules?.finalEditor?.perspectiveRule) {
        // fallback：无styleProfile.povRule时使用reviewRules（简单格式）
        _fePovSection = `\n\n【视角规则（审核依据——以此为准，不得自行提高标准）】\n${_feReviewRules.finalEditor.perspectiveRule}\n注意：视角违规的判定必须以此规则为准。只有当正文违反了此规则中的明确禁止项时，才能判定视角违规。`;
    }
    const _feReviewInjection = reviewRemediation.getReviewPromptInjectionSync(_feProject);

    const genre = resolveGenreFromProject(_feProject);
    const scheduled = await assembleMaterialState('final-editor', {
        projectId, chapter, materials: materials || [], ctx, project: _feProject, genre
    });
    const mats = scheduled.materials;
    const constraintsText = scheduled.constraints?.text || '';

    // 角色简表段：通过声明式配置（characterFormat='simple'）自动选择buildCharacterBriefSection
    const charSec = buildCharacterByFormat(mats.character, 'final-editor', '定稿依据');

    // 伏笔全量加载：合并未archived（调度器）+ archived（DataContext）的伏笔
    // 修复Phase 3引新bug：调度器默认不加载archived伏笔，定稿人需要看全量伏笔状态
    if (mats.foreshadowing) {
        mats.foreshadowing = await mergeWithArchivedForeshadows(mats.foreshadowing, ctx);
    }

    // 其余素材通过统一注入层注入
    // foreshadowFilter='all'已从声明读取（agentDeclarationsSupplement.js中final-editor配置）
    const materialAgentContext = { content: '' };
    injectMaterials(scheduled, materialAgentContext, {
        agentType: 'final-editor',
        totalBudget: 3500,
    });

    // 模块功能提示：告诉定稿人本章启用了哪些题材功能模块
    const _feModuleHintSection = buildModuleHint(genre, 'final-editor');

    agentContext.content = `【任务】你是定稿人，请定稿，绝不输出小说正文。\n\n【正文（仅供审核参考）】\n系统实际字数：${(chapter.content || '').length}字（此为系统精确计算，以此为准，忽略初审/复审中的估算字数）\n前500字：${(chapter.content || '').substring(0, 500)}\n末500字：${(chapter.content || '').substring(Math.max(0, (chapter.content || '').length - 500))}\n\n【初审结果】\n${(chapter.firstReviewOutput || '').substring(0, 1500)}\n\n【复审结果】\n${(chapter.secondReviewOutput || '').substring(0, 1500)}${_feReviewInjection}${_fePovSection}${constraintsText ? '\n\n【行为约束（审核依据——检查正文是否违反行为规则）】\n' + constraintsText + '\n' : ''}${charSec}${materialAgentContext.content}${_feModuleHintSection}\n\n【输出格式】先输出可读Markdown定稿意见，末尾附JSON数据块：\n${'```'}json\n{"approved":true/false,"action":"approve/reject/revise","edits":[],"ipDirection":"","materialGuidance":"","scheduleNote":""}\n${'```'}`;

    const result = await runAgent('final-editor', agentContext);
    chapter.finalEditorOutput = result.response;
    chapter.status = 'final-editing';
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);
    saveAgentOutput(projectId, chapter, 'final-editor', result.response);

    try {
        const parsed = extractJSON(result.response);
        if (!parsed) throw new Error('JSON extraction failed');

        // 软硬分离（SOP: 只有critical硬伤阻断，high/medium/low软性问题降级为suggestion不阻断）
        // 解决问题：定稿人把软性问题（润色建议/风格偏好等）当作拒绝理由，导致pipeline卡死
        // 判定原则：edits中无critical级硬伤时，强制通过，软性edits保留为建议不阻断
        if (!parsed.approved) {
            const criticalEdits = (parsed.edits || []).filter(e => e.severity === 'critical' || e.priority === 'critical');
            if (criticalEdits.length === 0) {
                logger.info('finalEditor', `final-editor soft-hard separation: no critical edits, auto-passing. ${(parsed.edits || []).length} soft edits kept as suggestions.`);
                parsed.approved = true;
                parsed.action = 'approve';
                parsed._autoCorrected = true;
                parsed._overrideReason = '无critical硬伤，软性问题降级为建议不阻断';
            }
        }

        await saveFinalEditorReview({ projectId, chapterId, chapter, parsed, round, ctx });
        if (parsed.approved) await handleApprovedChapter({ chapter, chapterId, projectId, parsed, modeConfig, ctx });
        return { step: 'final-editor', result, passed: parsed.approved, feedback: parsed, materialGuidance: parsed.materialGuidance, ipDirection: parsed.ipDirection, chapter };
    } catch (e) {
        logger.warn('finalEditor', 'final-editor JSON parse failed, fallback to markdown analysis');
        const text = result.response || '';
        const { approved: fallbackApproved, hasPipelineBlock, isNovelContent } = parseFallbackApproval(text);
        const fallbackFeedback = {
            approved: fallbackApproved, action: fallbackApproved ? 'approve' : 'reject',
            summary: hasPipelineBlock ? `定稿阻断（PIPELINE_BLOCK: ${text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || ''}）` : (isNovelContent ? '定稿人返回了小说正文而非审核结果，视为拒绝' : (fallbackApproved ? '定稿通过（Markdown格式）' : '定稿未通过（Markdown格式）')),
            edits: fallbackApproved ? [] : [{ description: hasPipelineBlock ? text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || '阻断问题' : (isNovelContent ? '定稿人未返回JSON审核结果' : '审核返回Markdown格式'), severity: 'critical' }]
        };
        const revId = uuidv4();
        await store.setItem('reviews', revId, { id: revId, chapterId, projectId, step: 'final-editor', type: 'final-editor', reviewer: 'final-editor-agent', result: fallbackFeedback, passed: fallbackApproved, content: fallbackFeedback.summary, issues: fallbackFeedback.edits, suggestions: [], round, createdAt: new Date().toISOString() });
        if (fallbackApproved) {
            chapter.status = STATUS_VALUES.APPROVED; chapter.content = cleanFinalContent(chapter.content || ''); chapter.wordCount = chapter.content.replace(/\s/g, '').length;
            const fbProject = await ctx.getProject();
            const fbMaxWords = (fbProject?.wordConfig || {}).maxWords || modeConfig?.word?.maxChapter || NOVEL_DEFAULTS.maxChapterWords;
            if (chapter.wordCount > fbMaxWords) { chapter.content = truncateChapter(chapter.content, fbMaxWords).content; chapter.wordCount = chapter.content.replace(/\s/g, '').length; }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
            saveFinalContent(projectId, chapter);
        }
        return { step: 'final-editor', result, passed: fallbackApproved, feedback: fallbackFeedback, materialGuidance: '', chapter };
    }
}

module.exports = { handleFinalEditor };
