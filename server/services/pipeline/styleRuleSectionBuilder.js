/**
 * styleRuleSectionBuilder.js — 风格规则约束区统一构建器
 *
 * 解决问题：
 *  - writer prompt 只注入了 povRule，缺失 toneRule/dialogueRule/behaviorRule/titleRule/characterRefRules
 *  - 导致 writer 看不到"每章3处笑点"等题材核心约束，产出偏离题材设定
 *  - 风格规则散落多处（styleHierarchy用于outline，repairMethods用于返修），writer无统一入口
 *
 * 统一方案（遵循povRuleSectionBuilder的架构模式）：
 *  - 风格规则只在此文件定义一次
 *  - writer/reviser 使用 buildWriterStyleRuleSection（创作约束口吻）
 *  - 审核员使用 buildReviewerStyleRuleSection（审核依据口吻）
 *  - povRule 不在此处注入（由 povRuleSectionBuilder 专门处理，含判定标准）
 */

/**
 * 构建writer/reviser的风格规则约束区
 * @param {object} styleProfile - 项目styleProfile
 * @returns {string} 风格规则约束区（不含povRule，povRule由povRuleSectionBuilder注入）
 */
function buildWriterStyleRuleSection(styleProfile) {
    if (!styleProfile) return '';
    const parts = [];
    if (styleProfile.dialogueRule) parts.push(`【对话规则】${styleProfile.dialogueRule}`);
    if (styleProfile.behaviorRule) parts.push(`【行为规则】${styleProfile.behaviorRule}`);
    if (styleProfile.toneRule) parts.push(`【语气基调·最高优先级】${styleProfile.toneRule}`);
    if (styleProfile.titleRule) parts.push(`【标题规则】${styleProfile.titleRule}`);
    if (styleProfile.characterRefRules) parts.push(`【称呼规范】${styleProfile.characterRefRules}`);
    if (parts.length === 0) return '';
    return `\n\n【风格规则 - 最高优先级，与审核规则冲突时以此为准】\n${parts.join('\n')}`;
}

/**
 * 构建审核员的风格规则约束区
 * @param {object} project - 项目对象（含styleProfile）
 * @returns {string} 风格规则审核依据区
 */
function buildReviewerStyleRuleSection(project) {
    const sp = project?.styleProfile;
    if (!sp) return '';
    const parts = [];
    if (sp.dialogueRule) parts.push(`【对话规则】${sp.dialogueRule}`);
    if (sp.behaviorRule) parts.push(`【行为规则】${sp.behaviorRule}`);
    if (sp.toneRule) parts.push(`【语气基调·审核依据】${sp.toneRule}`);
    if (sp.titleRule) parts.push(`【标题规则】${sp.titleRule}`);
    if (sp.characterRefRules) parts.push(`【称呼规范】${sp.characterRefRules}`);
    if (parts.length === 0) return '';
    return `\n\n【风格规则（审核依据——以此为准，不得自行提高或降低标准）】\n${parts.join('\n')}`;
}

module.exports = {
    buildWriterStyleRuleSection,
    buildReviewerStyleRuleSection
};
