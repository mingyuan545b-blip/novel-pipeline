const logger = require('../../shared/logger');

function buildHierarchyInjection(styleProfile, genre) {
    if (!styleProfile) return '';
    const parts = [];

    if (styleProfile.povRule) parts.push(`【视角规则·最高优先级】${styleProfile.povRule}`);
    if (styleProfile.dialogueRule) parts.push(`【对话规则】${styleProfile.dialogueRule}`);
    if (styleProfile.behaviorRule) parts.push(`【行为规则】${styleProfile.behaviorRule}`);
    if (styleProfile.toneRule) parts.push(`【语气基调】${styleProfile.toneRule}`);
    if (styleProfile.characterRefRules) parts.push(`【称呼规范】${styleProfile.characterRefRules}`);
    if (styleProfile.namingStyle) parts.push(`【命名风格】${styleProfile.namingStyle}`);
    if (styleProfile.protagonistName) parts.push(`【主角姓名】${styleProfile.protagonistName}`);
    if (styleProfile.worldviewTone) parts.push(`【世界观基调】${styleProfile.worldviewTone}`);
    if (styleProfile.narrativeDistance) parts.push(`【叙事距离】${styleProfile.narrativeDistance}`);

    return parts.join('\n');
}

function buildStyleInjection(styleProfile, genre) {
    const hierarchy = buildHierarchyInjection(styleProfile, genre);
    if (!hierarchy) return '';
    return `【风格配置 - 优先级从高到低】\n${hierarchy}`;
}

module.exports = { buildHierarchyInjection, buildStyleInjection };
