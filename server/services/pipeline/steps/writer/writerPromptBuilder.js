const logger = require('../../../../shared/logger');
const { getDataContext, resolveGenreFromProject, resolveConfig, resolve, reviewRemediation, trendingSearch } = require('./writerShared');
const { buildRelationshipStageGuard } = require('../../relationshipStageGuard');
const { getActiveConstraints, formatConstraintsForPrompt } = require('../../../consistencyConstraint');
const { onWriterPrompt } = require('../../../pipelineModuleRegistry');
const { buildModuleHint } = require('../../../genres/moduleHintBuilder');
const { buildWriterPovRuleSection } = require('../../povRuleSectionBuilder');
const { buildWritingGuardSection } = require('../../writingGuardSectionBuilder');
const { buildWriterStyleRuleSection } = require('../../styleRuleSectionBuilder');
const { buildExpansionInstruction } = require('../expansionInstructionBuilder');
const { buildLengthInstruction } = require('./sceneFloorInstruction');
// 上下文构建函数已拆分到 writerPromptContextBuilders.js（遵循200行单文件硬限制）
const { _buildNarrativeBridge, _buildTimeline, _buildForeshadow, _buildCharacterActivity, _buildCharacterStateSummary, _buildGuardHints } = require('./writerPromptContextBuilders');
// 修复数据断链：注入题材writerHints.terminologyDimming到writer prompt（原getGenreWriterInjection是死代码）
const { getGenreWriterInjection } = require('../../../genreDetectorHelpers');

async function buildWriterPrompt(params) {
    const { projectId, chapter, agentContext, context, config, genre, styleProfile, outlineText, materialSection, characterRefSection, nameLockSection, knowledgeAccessSection, budget, round } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const targetMin = config.word.targetMin;
    const targetMax = config.word.targetMax;
    const rejectMin = config.word.rejectMin;

    const narrativeBridgeSection = await _buildNarrativeBridge(ctx, chapter);
    const timelineSection = await _buildTimeline(ctx, chapter);
    const foreshadowSection = await _buildForeshadow(ctx, chapter);
    const characterActivitySection = await _buildCharacterActivity(ctx, chapter);
    const relationshipGuardSection = await buildRelationshipStageGuard(projectId, chapter.chapterNumber);
    const characterStateSection = await _buildCharacterStateSummary(projectId, chapter, styleProfile);
    const guardHintsSection = await _buildGuardHints(ctx, chapter, outlineText);

    // === 第一部分：任务说明（首因效应区，开头注意力最强）===
    // 只放任务核心：字数要求+结构+大纲+意图规划
    // 写作红线（敏感词/方括号/系统交互）由统一构建器注入，禁止硬编码
    // 视角红线由 povRuleSectionBuilder 在第四部分统一注入（含判定原则）
    const writingGuardSection = buildWritingGuardSection();
    agentContext.content = `创作第${chapter.chapterNumber}章正文：
${writingGuardSection}

${buildLengthInstruction(config.word)}
防重复：不逐字复制前文，时间推进须有新动作/对话。
${(() => { const vars = resolve(genre); return vars.SUPPORTING_WRITER_PRINCIPLES ? '\n' + vars.SUPPORTING_WRITER_PRINCIPLES : ''; })()}
${(() => { const inj = getGenreWriterInjection(genre); return inj ? '\n' + inj : ''; })()}
标题：${chapter.title}
大纲：${outlineText}
${context.chapterIntent ? '\n' + context.chapterIntent + '\n' : ''}${context.hookAgenda ? '\n' + context.hookAgenda + '\n' : ''}`;

    // === 第二部分：素材区（中间注意力较弱，放参考信息）===
    // 只放素材参考，不放约束
    agentContext.content += `${characterRefSection}${materialSection}${knowledgeAccessSection || ''}${narrativeBridgeSection}${timelineSection}${foreshadowSection}${characterActivitySection}`;

    // 模块功能提示：告诉writer本章启用了哪些题材功能模块
    const moduleHintSection = buildModuleHint(genre, 'writer');
    if (moduleHintSection) {
        agentContext.content += moduleHintSection;
        budget.allocate('module_hint', moduleHintSection);
    }

    // budget控制补全：为新增section添加budget.allocate
    if (project?.styleGuidance) budget.allocate('style_guidance', project.styleGuidance);
    const remediationText = reviewRemediation.getWriterPromptInjectionSync(project);
    if (remediationText) budget.allocate('review_feedback', remediationText);
    if (characterStateSection) budget.allocate('character_state', characterStateSection);
    if (guardHintsSection) budget.allocate('guard_hints', guardHintsSection);
    if (relationshipGuardSection) budget.allocate('relationship_guard', relationshipGuardSection);

    await _appendConsistencyConstraints(projectId, chapter.chapterNumber, agentContext);
    // behaviorTemplate已通过styleInjector.buildStyleProfileInjection()注入system prompt，不再重复注入user prompt
    await onWriterPrompt(projectId, chapter.chapterNumber, agentContext);
    _appendTrendingMemes(config, project, genre, agentContext);
    _appendMilestones(config, chapter, genre, agentContext);
    _appendSeasonInfo(config, project, chapter, agentContext);
    await _appendCrossSeason(projectId, project, chapter, agentContext);

    // === 第三部分：审核反馈（近因效应区，放最关键的约束）===
    _appendRoundContext(chapter, round, config, context, agentContext);

    // === 第四部分：约束集中区 + 角色名锁定 + 检查清单（近因效应最强区，放最后）===
    // 所有约束类内容集中在这里，利用近因效应确保LLM记住
    // SOP-1修复：注入povRule到约束区（确保writer看到完整视角规则）
    // 统一构建器：povRuleSectionBuilder.js，判定标准只定义一次，所有agent共用
    const povRuleSection = buildWriterPovRuleSection(styleProfile);
    if (povRuleSection) budget.allocate('pov_rule', povRuleSection);
    // SOP修复：注入完整风格规则（toneRule/dialogueRule/behaviorRule/titleRule/characterRefRules）
    // 修复前writer只看到povRule，看不到"每章3处笑点"等题材核心约束，导致产出偏离题材设定
    const styleRuleSection = buildWriterStyleRuleSection(styleProfile);
    if (styleRuleSection) budget.allocate('style_rules', styleRuleSection);
    agentContext.content += `${povRuleSection}${styleRuleSection}${relationshipGuardSection}${characterStateSection}${guardHintsSection}

${nameLockSection}

【最后检查清单 - 写完前必须逐项确认】
1. 角色名字是否与上方【角色名字锁定】区域完全一致？禁止自创、替换、改名
2. 视角自检（极其重要，违反即退回重写）：按上方【视角铁律】的判定原则逐句检查——主语是NPC且作者断言其心理=违规；主语是主角或主角推测=合规。误把主角自己的心理/回忆/感受判为违规属于严重失误。
3. 字数是否达到${rejectMin}字最低线？
4. 是否有方括号标签【...】残留？（禁止使用）
5. 是否有AI高频词？（仿佛/宛如/似乎/不禁/一抹/一丝等=必须删除重写）
6. 是否有文青病？（抽象抒情/空洞比喻/无意义意象堆砌=必须删除重写）
7. 角色状态/进度是否与前章一致？（石化/伤势/境界等进度不能倒退）
8. 审核反馈的每一条是否都已修改？（仅round>1时适用）`;

    logger.info('writerPrompt', `writer prompt length: ${agentContext.content.length}`);
    return agentContext;
}

async function _appendConsistencyConstraints(projectId, chapterNumber, agentContext) {
    try {
        const constraints = await getActiveConstraints(projectId, chapterNumber);
        const promptSection = formatConstraintsForPrompt(constraints);
        if (promptSection) agentContext.content += `\n\n${promptSection}`;
    } catch (err) {
        logger.warn('writerPrompt', 'Failed to load consistency constraints:', err.message);
    }
}

function _appendTrendingMemes(config, project, genre, agentContext) {
    if (!config.flow.requireTrendingMemes) return;
    trendingSearch.searchTrendingMemes(project?.genre || genre?.label || '网文', project?.name)
        .then(trending => { if (trending.injectionHint) agentContext.content += `\n\n${trending.injectionHint}`; })
        .catch(e => logger.warn('writerPrompt', 'trending search failed:', e.message));
}

function _appendMilestones(config, chapter, genre, agentContext) {
    const genreMilestones = config.milestones || {};
    if (Object.keys(genreMilestones).length === 0) return;
    const chNum = chapter.chapterNumber;
    const milestone = genreMilestones[chNum];
    if (milestone) agentContext.content += `\n\n【🎯 本章里程碑 - 必须达成】第${chNum}章是${genre?.label || ''}题材的关键节点：${milestone}。本章内容必须围绕此里程碑展开。`;
    const upcomingChapters = Object.entries(genreMilestones).filter(([n]) => Number(n) > chNum && Number(n) <= chNum + 3).map(([n, desc]) => `第${n}章: ${desc}`);
    if (upcomingChapters.length > 0) agentContext.content += `\n\n【📋 近期里程碑预告】${upcomingChapters.join('；')}。当前章节需为后续里程碑做好铺垫。`;
}

function _appendSeasonInfo(config, project, chapter, agentContext) {
    if (!config.seasons || !project?.season) return;
    try {
        const totalChapters = config.chapter.total || 28;
        if (chapter.chapterNumber === totalChapters && config.seasons?.SEASON_FINALE_HOOK) {
            agentContext.content += `\n\n【📺 季终章 - 必须包含季末悬念钩子】本章是本季最后一章，必须在解决当前冲突的同时，在结尾留下至少1个未闭合的悬念线索。禁止完美收尾，必须留钩子。`;
        }
        const seasonInfo = config.seasons[project.season];
        if (seasonInfo) agentContext.content += `\n\n【📺 当前季信息】第${project.season}季「${seasonInfo.name}」· 本季符咒：${seasonInfo.talismans.join('、')}· 本季暗影：${seasonInfo.shadows.join('、')}`;
    } catch (e) { logger.warn('writerPrompt', 'talisman season injection failed:', e.message); }
}

async function _appendCrossSeason(projectId, project, chapter, agentContext) {
    if (!project?.parentProjectId || !project?.season || project.season <= 1) return;
    try {
        const { getPreviousSeasonFinale } = require('../../../projectService');
        const prevFinale = await getPreviousSeasonFinale(projectId);
        if (prevFinale) agentContext.content += `\n\n【📖 上一季结局回顾】第${prevFinale.seasonNumber}季最终章「${prevFinale.lastChapterTitle || '无标题'}」：\n${(prevFinale.lastChapterContent || '').substring(0, 1500)}\n\n本章必须承接上一季的结局和未闭合线索。`;
    } catch (e) { logger.warn('writerPrompt', 'cross-season continuity injection failed:', e.message); }
}

function _appendRoundContext(chapter, round, config, context, agentContext) {
    if (chapter.content && round > 1) {
        const currentWc = chapter.content.replace(/\s/g, '').length;
        const wcTargetMin = config.word.targetMin;
        const wcTargetMax = config.word.targetMax;
        const wcRejectMin = config.word.rejectMin;
        if (currentWc < wcRejectMin) {
            const wcGap = wcTargetMin - currentWc;
            const ratio = currentWc / wcRejectMin;
            if (ratio < 0.6) agentContext.content += `\n\n⚠️字数严重不足(${currentWc}字<最低${wcRejectMin})，必须完全重写，目标${wcTargetMin}-${wcTargetMax}字。`;
            else agentContext.content += `\n\n【当前正文(参考并扩展)】\n${chapter.content.substring(0, 5000)}\n\n⚠️字数不足(${currentWc}字，差${wcGap}字达目标)，重写完整章节并扩展每个场景。`;
        } else if (currentWc < wcTargetMin) {
            agentContext.content += `\n\n【当前正文(参考并扩展)】\n${chapter.content.substring(0, 5000)}\n\n⚠️字数未达标(${currentWc}字，还需${wcTargetMin - currentWc}字)，扩展场景描写。`;
        } else {
            agentContext.content += `\n\n【当前正文(参考)】\n${chapter.content.substring(0, 5000)}`;
        }
        // 字数缺口时追加结构化扩写指令（统一构建器，显式数学量——flash/27B级模型对含糊指令不扩足，2026-09-06实测）
        if (currentWc < wcTargetMin) {
            const expansion = buildExpansionInstruction(currentWc, config.word, { mode: 'rewrite', attempt: Math.max(0, round - 1) });
            if (expansion) agentContext.content += '\n\n' + expansion;
        }
    }
    if (context.reviewFeedback) {
        agentContext.content += `\n\n【审核反馈(必须修改)】\n${context.reviewFeedback.substring(0, 2000)}`;
        const currentWc = chapter.content ? chapter.content.replace(/\s/g, '').length : 0;
        if (currentWc > 0) agentContext.content += `\n\n⚠️修改时字数保底：不删未涉及段落，替换内容≥原文，总字数≥${Math.max(currentWc, config.word.targetMin)}字。`;
    }
}

module.exports = { buildWriterPrompt };
