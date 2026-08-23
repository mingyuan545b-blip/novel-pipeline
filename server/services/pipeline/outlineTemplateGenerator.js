const logger = require('../../shared/logger');
const llm = require('../../services/llm');
const { getOutlineApiConfig } = require('./constants');
const { getGenrePlugin } = require('../genreConfig');
const { getConstraintPresets } = require('../prompts/constraintInjector');
const { buildTemplateSystemPrompt } = require('./outlineTemplateBuilder');
const { parseTemplateResponse } = require('./outlineResponseParser');
const { saveProjectFromTemplate, saveTemplateOutlines, saveMainQuests, saveTimeline } = require('./outlineMaterialSaver');

async function generateFromTemplate(template) {
    const { name, genre: genreStr, elements, targetChapters, style, tone, pov, setting, conflict, themes, constraints, wordConfig } = template;
    if (!name || !genreStr) throw new Error('name and genre are required');

    const initGenrePlugin = getGenrePlugin({ genre: genreStr });
    const initGenreMaterialFocus = initGenrePlugin?.styleProfile?.materialFocus || { primary: ['worldview', 'character', 'relationship', 'foreshadowing'] };
    const initGenreMaterialRules = initGenrePlugin?.materialRules || {};
    const elementStr = Array.isArray(elements) ? elements.join('、') : (elements || '');

    let styleInjection = '';
    if (initGenrePlugin?.styleProfile) {
        const sp = initGenrePlugin.styleProfile;
        styleInjection = '\n【本作风格配置（最高优先级，覆盖默认规则）】';
        if (sp.povRule) styleInjection += '\n' + sp.povRule;
        if (sp.dialogueRule) styleInjection += '\n' + sp.dialogueRule;
        if (sp.behaviorRule) styleInjection += '\n' + sp.behaviorRule;
        if (sp.toneRule) styleInjection += '\n' + sp.toneRule;
        if (sp.titleRule) styleInjection += '\n' + sp.titleRule;
    }

    let constraintInjection = '';
    if (constraints?.length) {
        const presets = await getConstraintPresets(initGenrePlugin);
        const items = constraints.map(id => presets[id]).filter(Boolean).map(c => `${c.label}：${c.desc}`);
        if (items.length) constraintInjection = `\n【写作约束（必须遵守）】\n${items.join('\n')}`;
    }

    const systemPrompt = buildTemplateSystemPrompt({
        name, genre: genreStr, elementStr,
        // Bug#9修复：兼容两套wordConfig字段名（targetMin和minWords/targetWords）
        targetWords: wordConfig?.targetMin || wordConfig?.targetWords || wordConfig?.minWords,
        targetChapters,
        style, tone, pov, setting, conflict, themes, styleInjection, constraintInjection,
        initGenreMaterialFocus, initGenreMaterialRules, initGenrePlugin
    });

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请为《${name}》生成完整的小说设定体系。题材：${genreStr}${elementStr ? '，元素：' + elementStr : ''}。` }
    ];

    logger.info('outlineGen', `generateFromTemplate: name=${name}, genre=${genreStr}`);
    const result = await llm.chat(messages, { maxTokens: 65536, temperature: 0.85, maxRetries: 8, retryDelay: 30000, apiConfig: await getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';
    logger.info('outlineGen', `generateFromTemplate response length: ${responseText.length}`);

    if (!responseText.trim()) return { projectId: null, success: false, error: 'AI returned empty response' };

    try {
        const parsed = parseTemplateResponse(responseText);
        logger.info('outlineGen', `parseTemplateResponse keys: ${Object.keys(parsed).join(', ')}`);
        logger.info('outlineGen', `parsed.materials: ${parsed.materials?.length || 0}, parsed.chapterOutlines: ${parsed.chapterOutlines?.length || 0}, parsed.mainQuests: ${parsed.mainQuests?.length || 0}, parsed.timeline: ${parsed.timeline?.length || 0}`);
        const projectId = await saveProjectFromTemplate(template);

        const materialResults = parsed.materials?.length
            ? await require('./outlineGenerator').generateInitialMaterials(projectId, `根据模板《${name}》生成素材`)
            : { created: [], count: 0 };

        const outlineResults = parsed.chapterOutlines?.length
            ? await saveTemplateOutlines(projectId, parsed.chapterOutlines)
            : { count: 0 };

        if (parsed.mainQuests?.length) await saveMainQuests(projectId, parsed.mainQuests);
        if (parsed.timeline?.length) await saveTimeline(projectId, parsed.timeline);

        return { projectId, success: true, materials: materialResults.count, outlines: outlineResults.count };
    } catch (e) {
        return { projectId: null, success: false, error: e.message, raw: responseText.substring(0, 500) };
    }
}

module.exports = { generateFromTemplate };
