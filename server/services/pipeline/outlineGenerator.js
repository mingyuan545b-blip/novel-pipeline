const logger = require('../../shared/logger');
const llm = require('../../services/llm');
const { getOutlineApiConfig } = require('./constants');
const { getReaderAdvisory, formatAdvisoryForOutline } = require('./readerAdvisory');
const { getGenrePlugin } = require('../genreConfig');
const { getVisibleMaterials } = require('./volumeHelpers');
const { buildVolumeRhythmGuidance } = require('./volumeRhythm');
const { resolveConfig } = require('../../config');
const { buildConstraintInjection } = require('../prompts/constraintInjector');
const { buildStyleInjection } = require('../prompts/styleInjector');
const { resolveGenreFromProject, detectGenre } = require('../../services/genreConfig');
const { getDataContext } = require('../dataContext');
const { buildMaterialTypeList, buildMaterialSystemPromptWithProject, buildMaterialUserPrompt, buildChapterOutlineSystemPrompt, buildSupplementOutlineSystemPrompt } = require('./outlineTemplateBuilder');
const { parseJsonResponse, parseMarkdownOutlines } = require('./outlineResponseParser');
const { saveMaterial, findExistingCharacterMaterial, updateExistingMaterial, createCharacterRelations, createEquipmentBinds, saveChapterOutlines } = require('./outlineMaterialSaver');
const { syncCharacterToEntityCenter, initCharacterKVState, autoSetProtagonistName } = require('./outlineEntitySync');
const { syncFactsFromMaterials } = require('../knowledgeBase');
const { detectOutlineDrift, formatDriftReport } = require('./outlineDriftGuard');
const { generateFromTemplate } = require('./outlineTemplateGenerator');

const DRIFT_MAX_RETRIES = 2;

async function generateInitialMaterials(projectId, userPrompt) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) throw new Error('Project not found');

    const enrichedProfile = { ...(project?.styleProfile || {}), genre: project?.genre, styleTemplateId: project?.styleTemplateId, genreProfile: project?.genreProfile };
    const genre = resolveGenreFromProject(project) || detectGenre(enrichedProfile);
    const materialFocus = genre?.styleProfile?.materialFocus || project?.styleProfile?.materialFocus || {};
    const materialRules = genre?.materialRules || {};
    const primaryTypes = materialFocus.primary || ['character', 'relationship', 'famous-scene', 'catchphrase', 'worldview', 'foreshadowing'];
    const secondaryTypes = materialFocus.secondary || [];
    const skipTypes = materialFocus.skip || [];

    const typeListStr = buildMaterialTypeList(primaryTypes, secondaryTypes, skipTypes, materialRules);
    const constraintInjection = await buildConstraintInjection(projectId, 'outline');
    const styleInjection = await buildStyleInjection(projectId);
    const systemContent = await buildMaterialSystemPromptWithProject(genre, typeListStr, constraintInjection + styleInjection, projectId);
    const userContent = buildMaterialUserPrompt(project, userPrompt, genre);

    const messages = [{ role: 'system', content: systemContent }, { role: 'user', content: userContent }];
    const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, enableThinking: false, apiConfig: await getOutlineApiConfig() });
    const responseText = result.choices?.[0]?.message?.content || '';
    logger.info('outlineGen', `generateInitialMaterials response length: ${responseText.length}`);

    try {
        const materials = parseJsonResponse(responseText);
        const created = [];
        for (const mat of materials) {
            if (mat.type === 'character' && mat.name) {
                const existing = await findExistingCharacterMaterial(projectId, mat.name);
                if (existing) { const updated = await updateExistingMaterial(existing, mat.content); created.push(updated); await syncCharacterToEntityCenter(projectId, mat, existing.id); continue; }
            }
            const item = await saveMaterial(projectId, mat);
            created.push(item);
            if (mat.type === 'character') { await syncCharacterToEntityCenter(projectId, mat, item.id); await initCharacterKVState(projectId, item.id, mat); }
        }
        await autoSetProtagonistName(projectId, materials);
        await createCharacterRelations(projectId, materials, created);
        await createEquipmentBinds(projectId, materials, created);
        const syncedFacts = await syncFactsFromMaterials(projectId, created);
        logger.info('outlineGen', `generateInitialMaterials: synced ${syncedFacts} facts to knowledge base`);
        return { created, count: created.length, syncedFacts };
    } catch (e) {
        return { created: [], count: 0, raw: responseText, error: e.message };
    }
}

async function generateChapterOutlines(projectId, userPrompt, overrideTargetCount) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) throw new Error('Project not found');
    const config = resolveConfig(resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {}), project);
    const targetCount = overrideTargetCount || config.chapter.total;
    const genre = resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {});

    for (let attempt = 0; attempt <= DRIFT_MAX_RETRIES; attempt++) {
        const visResult = await getVisibleMaterials(projectId, 0);
        const constraintInjection = await buildConstraintInjection(projectId, 'outline');
        const styleInjection = await buildStyleInjection(projectId);
        const rhythmGuidance = await buildVolumeRhythmGuidance(projectId);
        const advisory = await getReaderAdvisory(projectId, project);
        const advisoryStr = formatAdvisoryForOutline(advisory);
        const systemPrompt = buildChapterOutlineSystemPrompt(constraintInjection, styleInjection, rhythmGuidance, advisoryStr, targetCount);
        const materialSummary = visResult.materials.slice(0, 30).map(m => `[${m.type}] ${m.name}: ${(m.currentContent || '').substring(0, 100)}`).join('\n');
        const retryHint = attempt > 0 ? `\n\n【偏移修正提示】上一次生成的大纲存在题材偏移，请严格遵守题材约束重新生成。` : '';
        const userContent = `小说名称：${project.name}\n类型：${project.genre}\n描述：${project.description}\n\n已有素材：\n${materialSummary}\n\n用户需求：${userPrompt || '请生成完整大纲'}${retryHint}`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }];
        const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, apiConfig: await getOutlineApiConfig() });
        const responseText = result.choices?.[0]?.message?.content || '';
        try {
            const outlines = parseJsonResponse(responseText);
            const genrePlugin = getGenrePlugin(genre);
            const driftResult = detectOutlineDrift(outlines, genrePlugin);
            logger.info('outlineGen', formatDriftReport(driftResult));
            if (driftResult.hasDrift && attempt < DRIFT_MAX_RETRIES) { logger.warn('outlineGen', `大纲偏移检测失败 (attempt ${attempt + 1}/${DRIFT_MAX_RETRIES + 1}), 自动重试...`); continue; }
            if (driftResult.hasDrift) { logger.warn('outlineGen', `大纲偏移检测仍有${driftResult.issues.length}个问题，已达最大重试次数，保存但标记警告`); }
            const saved = await saveChapterOutlines(projectId, outlines);
            return { outlines: saved, created: saved, count: saved.length, driftIssues: driftResult.issues };
        } catch (e) {
            const fallbackOutlines = parseMarkdownOutlines(responseText);
            return { outlines: fallbackOutlines, created: fallbackOutlines, count: fallbackOutlines.length, raw: responseText, error: e.message };
        }
    }
}

async function supplementChapterOutlines(projectId, existingCount, supplementCount = 30, retryHint = '') {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) throw new Error('Project not found');
    const config = resolveConfig(resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {}), project);
    const genre = resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {});

    for (let attempt = 0; attempt <= DRIFT_MAX_RETRIES; attempt++) {
        const constraintInjection = await buildConstraintInjection(projectId, 'outline');
        const styleInjection = await buildStyleInjection(projectId);
        const visResult = await getVisibleMaterials(projectId, 0);
        const materialSummary = visResult.materials.slice(0, 20).map(m => `[${m.type}] ${m.name}`).join('\n');
        const startChapter = existingCount + 1;
        const endChapter = Math.min(startChapter + supplementCount - 1, config.chapter.total);
        const systemPrompt = buildSupplementOutlineSystemPrompt(constraintInjection, styleInjection, startChapter, endChapter);
        const driftRetryHint = attempt > 0 ? '\n【偏移修正提示】上一次生成的大纲存在题材偏移，请严格遵守题材约束重新生成。' : '';
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: `小说：${project.name}\n已有素材：\n${materialSummary}\n${retryHint}${driftRetryHint}` }];
        const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, apiConfig: await getOutlineApiConfig() });
        const responseText = result.choices?.[0]?.message?.content || '';
        try {
            const outlines = parseJsonResponse(responseText);
            const genrePlugin = getGenrePlugin(genre);
            const driftResult = detectOutlineDrift(outlines, genrePlugin);
            logger.info('outlineGen', formatDriftReport(driftResult));
            if (driftResult.hasDrift && attempt < DRIFT_MAX_RETRIES) { logger.warn('outlineGen', `补充大纲偏移检测失败 (attempt ${attempt + 1}/${DRIFT_MAX_RETRIES + 1}), 自动重试...`); continue; }
            const saved = await saveChapterOutlines(projectId, outlines);
            return { outlines: saved, created: saved, count: saved.length, driftIssues: driftResult.issues };
        } catch (e) { return { outlines: [], created: [], count: 0, error: e.message }; }
    }
}

module.exports = { generateInitialMaterials, parseMarkdownOutlines, generateChapterOutlines, generateFromTemplate, supplementChapterOutlines };
