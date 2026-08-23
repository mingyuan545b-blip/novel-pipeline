/**
 * stepContextBuilder - Pipeline步骤上下文组装
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { getVisibleMaterials, getVolumeSubplane } = require('./volumeHelpers');
const { getAgentPrompt } = require('../agentPrompts');
const { resolveGenreFromProject } = require('../genreConfig');
const { resolveConfig } = require('../../config');
const llmConfig = require('../llmConfig');
const { ContextBudget, COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES } = require('../contextBudget');
const memory = require('../memory');
const materialIndex = require('../materialIndex');

async function resolveMaterials(projectId, chapter, step) {
    let materialsRaw = (step === 'writer')
        ? await materialIndex.getMaterialsForScene(projectId, chapter.scene || '主世界', chapter.chapterNumber)
        : (await getVisibleMaterials(projectId, chapter.chapterNumber, { purpose: 'review' })).materials;
    let materials = Array.isArray(materialsRaw) ? materialsRaw : [];

    if (materials.length === 0 && step === 'writer') {
        logger.warn('pipeline', 'materialIndex returned 0 materials, falling back to store.queryItems');
        try {
            await materialIndex.rebuildIndex(projectId);
            materialsRaw = await materialIndex.getMaterialsForScene(projectId, chapter.scene || '主世界', chapter.chapterNumber);
            materials = Array.isArray(materialsRaw) ? materialsRaw : [];
        } catch (rebuildErr) {
            logger.warn('pipeline', `materialIndex.rebuildIndex failed: ${rebuildErr.message}`);
        }
        if (materials.length === 0) {
            logger.warn('pipeline', 'materialIndex still empty after rebuild, using store direct query');
            const allMats = await store.queryItems('materials', { projectId });
            materials = allMats.filter(m => !m.archived);
        }
    }
    return materials;
}

function buildBudgetAndMemoryConfig(model, context) {
    const budget = new ContextBudget(model, context.maxTokens || 8192);
    const priorities = budget.isUltraLongContext ? ULTRA_LONG_PRIORITIES : (budget.isLongContext ? LONG_PRIORITIES : COMPACT_PRIORITIES);
    const memorySlotBudget = Math.floor(budget.inputBudget * priorities.memory_context.maxRatio);
    const recentWindowSize = budget.isUltraLongContext ? 10 : 5;
    const maxMemoryTokens = budget.isUltraLongContext ? memorySlotBudget * 2 : memorySlotBudget;
    return { budget, priorities, recentWindowSize, maxMemoryTokens };
}

async function assembleMemoryContext(projectId, chapter, model, recentWindowSize, maxMemoryTokens) {
    let memoryContextStr = '';
    let memoryError = null;
    try {
        const assembledContext = await memory.assembleContext(
            projectId, chapter.chapterNumber, chapter.outline || '', model,
            { mentionedCharacters: [], recentWindowSize, maxTokens: maxMemoryTokens }
        );
        memoryContextStr = memory.formatContextForPrompt(assembledContext);
    } catch (memErr) {
        logger.warn('pipeline', `Memory context assembly failed: ${memErr.message}`);
        memoryError = memErr.message;
    }
    return { memoryContextStr, memoryError };
}

async function filterOtherSubplaneChars(memoryContextStr, projectId, chapter) {
    if (!memoryContextStr) return memoryContextStr;
    const _volumeInfo = await getVolumeSubplane(projectId, chapter.chapterNumber);
    const _currentSubplaneId = _volumeInfo ? _volumeInfo.subplaneId : null;
    const otherSubplaneCharNames = new Set();
    const allMats = await store.queryItems('materials', { projectId });
    allMats.filter(m => m.type === 'character' && m.parentPlane && m.parentPlane !== '主世界' && m.parentPlane !== _currentSubplaneId)
        .forEach(m => otherSubplaneCharNames.add(m.name));
    if (otherSubplaneCharNames.size > 0) {
        return memoryContextStr.split('\n')
            .filter(line => { for (const name of otherSubplaneCharNames) { if (line.includes(name)) return false; } return true; })
            .join('\n');
    }
    return memoryContextStr;
}

function buildMaterialsData(materials, memoryCoveredTypes) {
    const nonMemoryMaterials = materials.filter(m => !memoryCoveredTypes.has(m.type));
    return nonMemoryMaterials.reduce((acc, m) => {
        if (!acc[m.type]) acc[m.type] = [];
        const content = (m.currentContent || '').substring(0, 150);
        const entry = { n: m.name, c: content, t: m.tags };
        if (m.parentPlane) entry.pp = m.parentPlane;
        if (m.parentFaction) entry.pf = m.parentFaction;
        acc[m.type].push(entry);
        return acc;
    }, {});
}

async function buildStepContext(projectId, chapterId, step, round, context = {}) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const materials = await resolveMaterials(projectId, chapter, step);
    const project = await store.getItem('projects', projectId);
    const mode = project?.mode || context.mode || 'novel';
    const _legacyGenre = resolveGenreFromProject(project);
    const _legacyConfig = resolveConfig(_legacyGenre, project);
    const projectWordConfig = project?.wordConfig || {};
    const maxChapterWords = projectWordConfig.maxWords || _legacyConfig.word.maxChapter;

    const apiConfig = await llmConfig.resolveStepConfig(step, project);
    const model = apiConfig?.model || process.env.LLM_MODEL || process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL;

    const { budget, recentWindowSize, maxMemoryTokens } = buildBudgetAndMemoryConfig(model, context);
    const agentPrompt = await getAgentPrompt(step, mode, projectId);
    budget.allocate('agent_prompt', agentPrompt?.system || '');

    const { memoryContextStr, memoryError } = await assembleMemoryContext(projectId, chapter, model, recentWindowSize, maxMemoryTokens);
    const filteredMemory = await filterOtherSubplaneChars(memoryContextStr, projectId, chapter);

    const memoryCoveredTypes = new Set(['character', 'worldview', 'power-system', 'relationship', 'foreshadowing', 'growth-history', 'equipment', 'faction']);
    const materialsData = buildMaterialsData(materials, memoryCoveredTypes);

    const agentContext = {
        ...context, projectId, mode,
        materials: Object.keys(materialsData).length > 0 ? materialsData : undefined,
        memoryContext: filteredMemory?.length > 100 ? filteredMemory : undefined,
        apiConfig
    };

    const allChapters = (await store.queryItems('chapters', { projectId }))
        .filter(c => !c.archived).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const chapterIndex = allChapters.findIndex(c => c.id === chapterId);
    if (chapterIndex > 0) {
        const prevChapter = allChapters[chapterIndex - 1];
        // 陷阱#50修复：取结尾而非开头，让writer看到钩子能推断承接，避免把开头当模板复制（字数不减）
        agentContext.previousChapter = (prevChapter.content || '').slice(-1500);
    }

    if (step === 'writer' && round > 1 && chapter.content) {
        if (!chapter.history) chapter.history = [];
        chapter.history.push({ round: chapter.round || 1, content: (chapter.content || '').substring(0, 500), wordCount: (chapter.content || '').length, status: chapter.status, timestamp: new Date().toISOString() });
        if (chapter.history.length > 8) chapter.history = chapter.history.slice(-8);
    }

    return { chapter, materials, project, agentContext, _legacyConfig, _legacyGenre, maxChapterWords, budget, memoryError };
}

module.exports = { buildStepContext };
