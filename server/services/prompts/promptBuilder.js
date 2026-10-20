const store = require('../../store');
const logger = require('../../shared/logger');
const { buildFoundationFromModules } = require('./constraintModules');
const { getDataContext } = require('../dataContext');
const { getStyleProfileForProject, buildStyleProfileInjection } = require('./styleInjector');
const { buildFlavorInjection } = require('./flavorInjector');
const { buildGenreInjection } = require('./genreInjector');
const { FALLBACK_FOUNDATION, FALLBACK_AGENT_TEMPLATES } = require('./agentTemplateFallbacks');
const { deduplicateSystemPrompt } = require('./promptDedup');
const { getJobTemplate } = require('./agentJobTemplates');

async function getAgentTemplate(agentType, mode) {
    try {
        const templates = await store.listItems('agent-templates');
        const modeSpecific = templates.find(t => t.agentType === agentType && t.mode === mode);
        if (modeSpecific) return modeSpecific;
        const generic = templates.find(t => t.agentType === agentType && t.mode === 'novel');
        if (generic) return generic;
        const anyMatch = templates.find(t => t.agentType === agentType);
        if (anyMatch) return anyMatch;
    } catch(_) { logger.warn('promptBuilder', '[SILENT-CATCH]', { value1: _.message || _ }); }  // DEGRADE: 影响=store.listItems 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    const fallback = FALLBACK_AGENT_TEMPLATES[agentType];
    if (fallback) return fallback;
    return null;
}

async function getFoundationPrompt(agentType, genrePlugin = null) {
    return buildFoundationFromModules(agentType, genrePlugin);
}

async function buildFoundationPrompt(agentType, mode = 'novel', projectIdOrPlugin = null) {
    // 从agentJobTemplates动态读取label/task，避免硬编码重复定义
    const template = getJobTemplate(agentType);
    const roleMap = {};
    const taskMap = {};
    if (template) {
        roleMap[agentType] = template.label;
        taskMap[agentType] = template.task;
    }

    let genrePlugin = null;
    if (projectIdOrPlugin && typeof projectIdOrPlugin === 'object') {
        genrePlugin = projectIdOrPlugin;
    } else if (projectIdOrPlugin && typeof projectIdOrPlugin === 'string') {
        const _pbCtx = await getDataContext(projectIdOrPlugin);
        const project = await _pbCtx.getProject();
        if (project) {
            const { getGenrePlugin } = require('../genreConfig');
            const enrichedProfile = { ...project, genre: project.genre, styleTemplateId: project.styleTemplateId };
            genrePlugin = getGenrePlugin(enrichedProfile);
        }
    }

    let raw = await getFoundationPrompt(agentType, genrePlugin);
    if (typeof raw !== 'string') raw = raw ? JSON.stringify(raw) : buildFoundationFromModules(agentType, genrePlugin);
    let prompt = raw
        .replace('[Agent类型]', roleMap[agentType] || agentType)
        .replace('[任务描述]', taskMap[agentType] || '完成指定任务');
    return prompt;
}

async function getAgentPrompt(agentType, mode = 'novel', projectId = null, options = {}) {
    const buildLog = [];
    const profile = projectId ? await getStyleProfileForProject(projectId) : null;
    const template = await getAgentTemplate(agentType, mode);
    if (!template) return null;

    let agent = { role: template.role, system: template.system, tool: template.tool };
    buildLog.push({ step: 'template', chars: template.system.length });

    if (!projectId) { agent._buildLog = buildLog; return agent; }

    const _pb2Ctx = await getDataContext(projectId);
    const project = await _pb2Ctx.getProject();
    if (!project) { agent._buildLog = buildLog; return agent; }

    if (project.agentOverrides?.[agentType]) {
        const before = agent.system.length;
        agent = { ...agent, system: project.agentOverrides[agentType] };
        buildLog.push({ step: 'agentOverride', chars: agent.system.length - before });
    }

    if (profile) {
        let systemOverride = agent.system;
        const { detectGenre } = require('../genreConfig');
        const genre = detectGenre(profile);

        const localProfile = { ...profile, constraintOverrides: profile.constraintOverrides ? [...profile.constraintOverrides] : undefined };

        if (genre?.genreBase) {
            if (localProfile.behaviorRule && genre.genreBase.BEHAVIOR_APPEND && !localProfile.behaviorRule.includes(genre.genreBase.BEHAVIOR_APPEND)) localProfile.behaviorRule += '\n' + genre.genreBase.BEHAVIOR_APPEND;
            if (localProfile.toneRule && genre.genreBase.TONE_APPEND && !localProfile.toneRule.includes(genre.genreBase.TONE_APPEND)) localProfile.toneRule += '\n' + genre.genreBase.TONE_APPEND;
            if (localProfile.reviewFocus && genre.genreBase.REVIEW_APPEND && !localProfile.reviewFocus.includes(genre.genreBase.REVIEW_APPEND)) localProfile.reviewFocus += genre.genreBase.REVIEW_APPEND;
            if (localProfile.constraintOverrides && genre.genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
                for (const rc of genre.genreBase.REQUIRED_CONSTRAINT_OVERRIDES) { if (!localProfile.constraintOverrides.includes(rc)) localProfile.constraintOverrides.push(rc); }
            }
        }

        if (genre?.foundation?.additionalFoundationRules?.length) {
            const genreRules = genre.foundation.additionalFoundationRules.join('\n');
            systemOverride = systemOverride.replace('[GENRE_RULES]', genreRules);
            buildLog.push({ step: 'genreRules', chars: genreRules.length });
        } else {
            systemOverride = systemOverride.replace('- 【题材视角铁律】由题材配置动态注入，见[GENRE_RULES]', '');
        }

        const styleResult = await buildStyleProfileInjection(localProfile, agentType, genre, projectId);
        if (styleResult.prepend) systemOverride = styleResult.prepend + systemOverride;
        if (styleResult.append) systemOverride += styleResult.append;
        for (const entry of styleResult.logEntries) buildLog.push(entry);

        const flavorResult = await buildFlavorInjection(projectId, agentType, genre);
        if (flavorResult.text) systemOverride += flavorResult.text;
        for (const entry of flavorResult.logEntries) buildLog.push(entry);

        const genreResult = await buildGenreInjection(projectId, agentType, project, { chapterNumber: options?.chapterNumber || project.currentChapter });
        if (genreResult.text) systemOverride += genreResult.text;
        for (const entry of genreResult.logEntries) buildLog.push(entry);

        agent = { ...agent, system: systemOverride };
    }

    buildLog.push({ step: 'final', chars: agent.system.length });
    agent._buildLog = buildLog;
    return agent;
}

module.exports = {
    FALLBACK_FOUNDATION, FALLBACK_AGENT_TEMPLATES,
    getAgentTemplate, getFoundationPrompt, buildFoundationPrompt,
    deduplicateSystemPrompt, getAgentPrompt
};
