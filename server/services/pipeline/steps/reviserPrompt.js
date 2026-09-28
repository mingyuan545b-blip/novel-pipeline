/**
 * reviserPrompt.js — 返修员prompt构建
 * 从reviser.js拆出，负责组装reviser的完整prompt
 */
const store = require('../../../store');
const { resolveGenreFromProject, getGenreReviewRules } = require('../../genreConfig');
const { buildRelationshipStageGuard } = require('../relationshipStageGuard');
const { assembleMaterialState } = require('../materialStateAssembler');
const { injectMaterials, buildCharacterByFormat } = require('../materialInjector');
const { buildNameLockSection } = require('./writer/writerCharacterFormatter');
const { getDataContext } = require('../../dataContext');
const { buildModuleHint } = require('../../genres/moduleHintBuilder');
const { buildWriterPovRuleSection } = require('../povRuleSectionBuilder');
const { buildWritingGuardSection } = require('../writingGuardSectionBuilder');
const { countWords, buildExpansionInstruction } = require('./expansionInstructionBuilder');
const { resolveConfig } = require('../../../config/unifiedConfig');
const logger = require('../../../shared/logger');

/** 加载素材和构建prompt上下文 */
async function buildReviserContext({ projectId, chapter, materials, agentContext, context, project }) {
    const chapterContent = chapter.content || '';
    agentContext.chapterContent = chapterContent;
    agentContext.chapterOutline = (chapter.outline || '').substring(0, 1000);

    const relationshipGuard = await buildRelationshipStageGuard(projectId, chapter.chapterNumber);
    const genre = resolveGenreFromProject(project);
    const scheduled = await assembleMaterialState('reviser', { projectId, chapter, materials, ctx: {}, project, genre });
    const constraintsText = scheduled.constraints?.text || '';

    // 角色段：通过声明式配置（characterFormat='brief'）自动选择buildCharacterSection
    const scheduledChars = scheduled.materials.character || [];
    const charSection = buildCharacterByFormat(scheduledChars, 'reviser', '修改时必须遵守');
    // 返修员也需要角色名锁定，避免修改时改错角色名
    const nameLockSection = buildNameLockSection(scheduledChars, false, null);

    // 其余素材通过统一注入层注入
    const materialAgentContext = { content: '' };
    injectMaterials(scheduled, materialAgentContext, {
        agentType: 'reviser',
        totalBudget: 6000,
    });

    const intentSection = _buildIntentSection(agentContext, context);
    const { timelineSection, foreshadowSection } = await _loadTimelineAndForeshadow(projectId, chapter.chapterNumber);
    const reviewRules = await _loadReviewRules(projectId);

    // SOP-1修复：注入povRule到返修约束区（确保返修员看到完整视角规则）
    // 统一构建器：povRuleSectionBuilder.js，判定标准只定义一次，所有agent共用
    const povRuleSection = buildWriterPovRuleSection(reviewRules.project?.styleProfile);

    // 模块功能提示：告诉返修员本章启用了哪些题材功能模块
    const moduleHintSection = buildModuleHint(genre, 'reviser');

    // 写作红线（敏感词/方括号/系统交互）由统一构建器注入，禁止硬编码
    const writingGuardSection = buildWritingGuardSection();

    // 字数缺口时注入结构化扩写任务（统一构建器）——修复reviser对含糊指令"必须扩充"只加十几字的平台期
    // （2026-09-06云端E2E实测2157→2170→2170；与本地RUN3三连败同根因）
    const reviserWordConfig = resolveConfig(genre, project).word;
    const wordCountBefore = countWords(chapterContent);
    const expansionInstruction = buildExpansionInstruction(
        wordCountBefore, reviserWordConfig,
        { mode: 'revise', attempt: Math.max(0, (context.round || 2) - 1) }
    );
    // 扩写任务信息随返回值下传：reviser.js据此做步内升级重试（首轮扩写未达标不白烧轮次）
    const expansionTask = expansionInstruction ? { targetMin: reviserWordConfig.targetMin, wordCountBefore } : null;

    agentContext.content = `${povRuleSection}${relationshipGuard}
${constraintsText ? '\n\n【行为约束（修改依据——必须遵守行为规则）】\n' + constraintsText + '\n' : ''}
${charSection}${materialAgentContext.content}${intentSection}${timelineSection}${foreshadowSection}${moduleHintSection}

${writingGuardSection}

请根据审核反馈对正文进行精准修改。
${expansionInstruction ? '\n' + expansionInstruction + '\n' : ''}
【当前正文】
${chapterContent.substring(0, 12000)}

【审核反馈（必须逐条修改以下所有问题，不可遗漏任何一条）】
${(context.reviewFeedback || '').substring(0, 4000)}

【修改规则 - 极其重要】
1. 必须逐条修改反馈中列出的每一个问题，不可跳过或遗漏任何一条
2. 每个问题必须定位到原文具体位置，替换为反馈中建议的改法
3. 修改后必须保持上下文连贯，不能出现断裂或重复
4. 修改后字数不得低于原文字数的95%，若原文字数不足目标区间则必须扩充
5. ${reviewRules.styleRule}
6. 直接输出修改后的完整正文，不要加任何标题标记
7. 严禁在修改中引入新的视角越界、系统机制直述或信息注入节奏违规
8. 如果意图规划中指定了视角锁定（如"本章锁定薄寒视角"），修改时必须严格维持该视角，禁止切换到其他角色内心或上帝视角
${reviewRules.extraRules}
${nameLockSection}

【最后提醒 - 写完前必须检查】
1. 角色名字是否与上方【角色名字锁定】区域完全一致？
2. 视角自检（极其重要，违反即退回重写）：按上方【视角铁律】的判定原则逐句检查——主语是NPC且作者断言其心理=违规；主语是主角或主角推测=合规。误把主角自己的心理/回忆/感受判为违规属于严重失误。
3. 是否有AI高频词？（仿佛/宛如/似乎/不禁/一抹/一丝等=必须删除重写）
4. 是否有文青病？（抽象抒情/空洞比喻/无意义意象堆砌=必须删除重写）
5. 角色状态/进度是否与前章一致？（石化/伤势/境界等进度不能倒退）
6. 审核反馈的每一条是否都已修改？`;

    return { scheduled, expansionTask };
}

function _buildIntentSection(agentContext, context) {
    const chapterIntent = agentContext.chapterIntent || context?.chapterIntent || '';
    if (!chapterIntent) return '';
    return `\n【意图规划约束（修改时必须严格遵守）】\n以下为意图管理员为本章设定的写作约束，修改正文时必须以此为最高优先级：\n${chapterIntent}\n⚠️ 特别注意Must Avoid条目：如果审核反馈指出视角越界/POV Jump，必须严格按意图规划中的视角锁定规则修改，禁止从其他角色视角描写。`;
}

async function _loadTimelineAndForeshadow(projectId, chapterNumber) {
    let timelineSection = '', foreshadowSection = '';
    try {
        const ctx = await getDataContext(projectId);
        const timelineSummary = await ctx.getTimelineSummary(chapterNumber, 5, 600);
        if (timelineSummary) timelineSection = `\n\n${timelineSummary}\n【时间线规则】修改时必须与前章时间线保持连贯，不得引入时间矛盾。`;
        const foreshadowHint = await ctx.getForeshadowHint(chapterNumber);
        if (foreshadowHint) foreshadowSection = `\n\n${foreshadowHint}\n【伏笔规则】修改时必须保持伏笔一致性，不得遗忘或矛盾。`;
    } catch (e) { logger.warn('reviser', 'Timeline/Foreshadow load failed:', e.message || e); }
    return { timelineSection, foreshadowSection };
}

async function _loadReviewRules(projectId) {
    const ctx = await getDataContext(projectId);
    const proj = await ctx.getProject();
    const genre = resolveGenreFromProject(proj);
    const rules = getGenreReviewRules(genre);
    const styleRule = '禁止在修改中引入与题材风格不符的表述';
    const extraRules = [
        rules?.reviser?.terminologyDimmingRule,
        rules?.reviser?.perspectiveRule,
        rules?.reviser?.repairRules,
    ].filter(Boolean).map(r => '\n' + r + '\n').join('');
    return { styleRule, extraRules, genre, project: proj };
}

module.exports = { buildReviserContext };
