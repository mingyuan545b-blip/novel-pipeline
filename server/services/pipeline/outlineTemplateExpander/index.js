const { buildTemplatePrompt, ALL_MATERIAL_DESCRIPTIONS } = require('./templatePromptBuilder');
const { createTemplateEntities } = require('./templateEntityCreator');
const { associateTemplateEntities } = require('./templateEntityAssociator');
const store = require('../../../store');
const llm = require('../../llm');
const { resolveConfig } = require('../../../config');
const { getGenrePlugin } = require('../../genreConfig');
const { AGENT_DEFAULTS } = require('../../../config/systemConfig');
const logger = require('../../../shared/logger');

async function expandTemplate(projectId, config) {
    const now = new Date().toISOString();
    const project = await store.getItem('projects', projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const effectiveConfig = resolveConfig(project);
    const genrePlugin = getGenrePlugin(project.styleProfile || { genre: project.genre, key: project.subGenre || project.subgenre });

    const fullConfig = {
        ...config, genre: config.genre || project.genre || 'unknown',
        targetChapters: config.targetChapters ?? effectiveConfig.targetChapters ?? 100,
        targetWords: config.targetWords || effectiveConfig.targetWords,
        style: config.style || effectiveConfig.style || '',
        tone: config.tone || effectiveConfig.tone || '',
        pov: config.pov || effectiveConfig.pov || '',
        setting: config.setting || effectiveConfig.setting || '',
        conflict: config.conflict || effectiveConfig.conflict || '',
        themes: config.themes || effectiveConfig.themes || '',
        genrePlugin,
    };

    let styleInjection = '';
    try {
        const styleInjector = require('../../prompts/styleInjector');
        styleInjection = await styleInjector.buildStyleInjection(projectId);
    } catch (_) { /* style injection optional */ }

    let constraintInjection = '';
    try {
        const constraintInjector = require('../../prompts/constraintInjector');
        constraintInjection = await constraintInjector.buildConstraintInjection(projectId, 'outline');
    } catch (_) { /* constraint injection optional */ }

    fullConfig.styleInjection = styleInjection;
    fullConfig.constraintInjection = constraintInjection;

    const prompt = buildTemplatePrompt(fullConfig);
    logger.info('outlineTemplateExpander', '[PIPELINE] Expanding template for project {projectId}, prompt length: {promptLen}', { projectId, promptLen: prompt.length });

    const agentConfig = {
        provider: effectiveConfig.provider || AGENT_DEFAULTS.provider,
        apiKey: effectiveConfig.apiKey || process.env.ALIYUN_CODING_API_KEY || '',
        model: effectiveConfig.model || AGENT_DEFAULTS.model,
        baseURL: effectiveConfig.baseURL,
        groupId: effectiveConfig.groupId,
        temperature: 0.8,
        maxTokens: 16000,
        enableThinking: false,
    };

    const result = await llm.chat(
        [{ role: 'user', content: prompt }],
        { apiConfig: agentConfig, maxTokens: agentConfig.maxTokens, temperature: agentConfig.temperature }
    );
    const content = result?.choices?.[0]?.message?.content || '';

    let parsed;
    try {
        const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
        logger.warn('outlineTemplateExpander', '[PIPELINE] Failed to parse template expansion result: {err}', { err: parseErr.message });
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch (_) { throw new Error('Template expansion result is not valid JSON'); }
        } else {
            throw new Error('Template expansion result is not valid JSON');
        }
    }

    const { createdMaterials, createdQuests, createdTimelines, createdChapters } = await createTemplateEntities(parsed, projectId, now);

    await associateTemplateEntities(projectId);

    project.templateExpanded = true;
    project.templateExpandedAt = now;
    await store.setItem('projects', projectId, project);

    logger.info('outlineTemplateExpander', '[PIPELINE] Template expanded: {matCount} materials, {questCount} quests, {tlCount} timelines, {chCount} chapters', { matCount: createdMaterials.length, questCount: createdQuests.length, tlCount: createdTimelines.length, chCount: createdChapters.length });

    return { materials: createdMaterials, quests: createdQuests, timelines: createdTimelines, chapters: createdChapters };
}

module.exports = { expandTemplate, buildTemplatePrompt, ALL_MATERIAL_DESCRIPTIONS };
