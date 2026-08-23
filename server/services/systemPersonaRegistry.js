const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { getDataContext } = require('./dataContext');

const PERSONA_DIR = path.join(__dirname, '../../data/system-personas');

let personas = new Map();

function load() {
    personas.clear();
    if (!fs.existsSync(PERSONA_DIR)) return 0;
    const files = fs.readdirSync(PERSONA_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(PERSONA_DIR, file), 'utf8'));
            personas.set(data.id, data);
        } catch(_) { logger.warn('systemPersonaRegistr', _.message || _); }
    }
    return personas.size;
}

function list() { return Array.from(personas.values()); }

function get(id) { return personas.get(id) || null; }

function listByCategory(category) {
    return list().filter(p => p.category === category);
}

function buildWriterPrompt(personaId) {
    const persona = get(personaId);
    if (!persona) return '';

    const parts = [];
    parts.push(`【系统人格：${persona.label}（${persona.tag}）】`);
    parts.push(`核心性格：${persona.personality.coreTrait}`);
    parts.push(`说话模式：${persona.personality.speechPattern}`);
    parts.push(`对宿主态度：${persona.personality.attitudeTowardHost}`);

    if (persona.interface) {
        parts.push('\n【系统界面规范】');
        if (persona.interface.notificationFormat) parts.push(`通知格式：${persona.interface.notificationFormat}`);
        if (persona.interface.rewardFormat) parts.push(`奖励格式：${persona.interface.rewardFormat}`);
        if (persona.interface.penaltyFormat) parts.push(`惩罚格式：${persona.interface.penaltyFormat}`);
        if (persona.interface.questFormat) parts.push(`任务格式：${persona.interface.questFormat}`);
        if (persona.interface.shopFormat) parts.push(`商城格式：${persona.interface.shopFormat}`);
        if (persona.interface.levelUpFormat) parts.push(`升级格式：${persona.interface.levelUpFormat}`);
    }

    if (persona.interactionRules) {
        parts.push('\n【互动规则】');
        if (persona.interactionRules.pricingStrategy) parts.push(`定价策略：${persona.interactionRules.pricingStrategy}`);
        if (persona.interactionRules.questStyle) parts.push(`任务风格：${persona.interactionRules.questStyle}`);
        if (persona.interactionRules.rewardStyle) parts.push(`奖励风格：${persona.interactionRules.rewardStyle}`);
        if (persona.interactionRules.bargainRule) parts.push(`砍价规则：${persona.interactionRules.bargainRule}`);
        if (persona.interactionRules.hiddenBenefit) parts.push(`隐藏福利：${persona.interactionRules.hiddenBenefit}`);
    }

    if (persona.narrativeIntegration) {
        parts.push('\n【叙事融入规则】');
        if (persona.narrativeIntegration.appearanceRule) parts.push(`出现方式：${persona.narrativeIntegration.appearanceRule}`);
        if (persona.narrativeIntegration.visibilityRule) parts.push(`可见性：${persona.narrativeIntegration.visibilityRule}`);
        if (persona.narrativeIntegration.emotionDisplay) parts.push(`情绪表现：${persona.narrativeIntegration.emotionDisplay}`);
        if (persona.narrativeIntegration.growthRule) parts.push(`成长规则：${persona.narrativeIntegration.growthRule}`);
    }

    if (persona.dialogueExamples) {
        parts.push('\n【对话示例】');
        for (const [scene, examples] of Object.entries(persona.dialogueExamples)) {
            if (examples?.length) {
                const sceneLabel = { bindHost: '绑定', publishQuest: '发任务', rewardHost: '给奖励', punishHost: '惩罚', bargain: '砍价', hostComplaint: '宿主抱怨', emergency: '紧急' }[scene] || scene;
                parts.push(`${sceneLabel}：${examples[0]}`);
            }
        }
    }

    if (persona.forbiddenPatterns?.length) {
        parts.push('\n【禁忌】');
        persona.forbiddenPatterns.forEach(f => parts.push(`❌ ${f}`));
    }

    return parts.join('\n');
}

function buildReviewerPrompt(personaId) {
    const persona = get(personaId);
    if (!persona) return '';

    const parts = [];
    parts.push(`【系统人格审核规范：${persona.label}】`);
    parts.push(`系统通知必须使用该人格的格式和语气，不得用通用格式替代`);
    parts.push(`系统对话必须符合${persona.personality.speechPattern}的说话模式`);

    if (persona.forbiddenPatterns?.length) {
        parts.push('以下情况视为系统人格违规：');
        persona.forbiddenPatterns.forEach(f => parts.push(`- ${f}`));
    }

    return parts.join('\n');
}

async function buildCombinedWriterPrompt(projectId) {
    const store = require('../store');
    const _sprCtx = await getDataContext(projectId);
    const project = await _sprCtx.getProject();
    if (!project) return '';

    const personaId = project.styleProfile?.systemPersona || '';
    if (!personaId) return '';

    const block = buildWriterPrompt(personaId);
    return block ? `【系统人格配置】\n${block}` : '';
}

async function buildCombinedReviewerPrompt(projectId) {
    const store = require('../store');
    const _sprrCtx = await getDataContext(projectId);
    const project = await _sprrCtx.getProject();
    if (!project) return '';

    const personaId = project.styleProfile?.systemPersona || '';
    if (!personaId) return '';

    return buildReviewerPrompt(personaId);
}

function reload() { return load(); }

load();

module.exports = { list, get, listByCategory, buildWriterPrompt, buildReviewerPrompt, buildCombinedWriterPrompt, buildCombinedReviewerPrompt, reload };
