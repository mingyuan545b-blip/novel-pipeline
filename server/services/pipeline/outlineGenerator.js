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
const { buildChapterOutlineSystemPrompt, buildSupplementOutlineSystemPrompt, buildOutlineMaterialDigest } = require('./outlineTemplateBuilder');
const { parseJsonResponse, parseMarkdownOutlines } = require('./outlineResponseParser');
const { saveChapterOutlines } = require('./outlineMaterialSaver');
const { detectOutlineDrift, formatDriftReport } = require('./outlineDriftGuard');
const { generateFromTemplate } = require('./outlineTemplateGenerator');

const DRIFT_MAX_RETRIES = 2;

// 初始素材生成已拆到 materialGenerator.js（保持单文件≤200行）；此处仅再导出以兼容既有调用点
const { generateInitialMaterials } = require('./materialGenerator');


/**
 * 大纲生成后自动初始化主线任务/阶段任务/时间线（幂等）。
 *
 * 背景（2026-09-21 排查"主线任务为0"）：
 *   autoInitProject 只在 POST /api/projects/initialize 里被调用，
 *   而实际常用路径是 POST /api/pipeline/generate-outlines（前端与大纲页都走这条）
 *   → 新项目永远没有主线任务，健康监控持续报"主线任务为0，陷阱#58未修复"。
 *   这里挂在大纲保存成功之后，两条路径行为归一；失败仅告警不阻断大纲生成。
 */
async function ensureProjectQuests(projectId) {
    try {
        const { autoInitProject } = require('../../routes/questAutoInit');
        const result = await autoInitProject(projectId);
        logger.info('outlineGen', `任务/时间线自动初始化完成：quests=${result.created?.quests || 0}, timelines=${result.created?.timelines || 0}, main="${result.summary?.mainQuest || ''}"`);
        return result;
    } catch (e) {
        logger.warn('outlineGen', `任务/时间线自动初始化失败（不阻断大纲）: ${e.message}`);
        return null;
    }
}

/**
 * 生成章节大纲（远景/细节两档，P1-4b）
 * @param {string} projectId
 * @param {string} userPrompt
 * @param {number} overrideTargetCount
 * @param {{scope?: 'far'|'detail'}} [options] far=远景粗纲（默认，只给素材名录、禁写设定细节）
 *        detail=保留旧行为（带素材内容摘要），仅用于确需一次性定细节的场景
 */
async function generateChapterOutlines(projectId, userPrompt, overrideTargetCount, options = {}) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) throw new Error('Project not found');
    const config = resolveConfig(resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {}), project);
    const targetCount = overrideTargetCount || config.chapter.total;
    const genre = resolveGenreFromProject(project) || detectGenre(project?.styleProfile || {});
    const scope = options.scope === 'detail' ? 'detail' : 'far';

    for (let attempt = 0; attempt <= DRIFT_MAX_RETRIES; attempt++) {
        const visResult = await getVisibleMaterials(projectId, 0);
        const constraintInjection = await buildConstraintInjection(projectId, 'outline');
        const styleInjection = await buildStyleInjection(projectId);
        const rhythmGuidance = await buildVolumeRhythmGuidance(projectId);
        const advisory = await getReaderAdvisory(projectId, project);
        const advisoryStr = formatAdvisoryForOutline(advisory);
        const systemPrompt = buildChapterOutlineSystemPrompt(constraintInjection, styleInjection, rhythmGuidance, advisoryStr, targetCount, scope);
        // 远景只给"名录"，不喂素材内容：避免规划超前于素材生长而写死细节
        const materialSummary = buildOutlineMaterialDigest(visResult.materials, scope);
        const retryHint = attempt > 0 ? `\n\n【偏移修正提示】上一次生成的大纲存在题材偏移，请严格遵守题材约束重新生成。` : '';
        const userContent = `小说名称：${project.name}\n类型：${project.genre}\n描述：${project.description}\n\n已有素材：\n${materialSummary}\n\n用户需求：${userPrompt || '请生成完整大纲'}${retryHint}`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }];
        const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, apiConfig: await getOutlineApiConfig(), projectId, usageStep: 'outline-generator' });
        const responseText = result.choices?.[0]?.message?.content || '';
        try {
            const outlines = parseJsonResponse(responseText);
            const genrePlugin = getGenrePlugin(genre);
            const driftResult = detectOutlineDrift(outlines, genrePlugin);
            logger.info('outlineGen', formatDriftReport(driftResult));
            if (driftResult.hasDrift && attempt < DRIFT_MAX_RETRIES) { logger.warn('outlineGen', `大纲偏移检测失败 (attempt ${attempt + 1}/${DRIFT_MAX_RETRIES + 1}), 自动重试...`); continue; }
            if (driftResult.hasDrift) { logger.warn('outlineGen', `大纲偏移检测仍有${driftResult.issues.length}个问题，已达最大重试次数，保存但标记警告`); }
            const saved = await saveChapterOutlines(projectId, outlines);
            await ensureProjectQuests(projectId);
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
        const result = await llm.chat(messages, { maxTokens: 32768, temperature: 0.8, apiConfig: await getOutlineApiConfig(), projectId, usageStep: 'outline-generator' });
        const responseText = result.choices?.[0]?.message?.content || '';
        try {
            const outlines = parseJsonResponse(responseText);
            const genrePlugin = getGenrePlugin(genre);
            const driftResult = detectOutlineDrift(outlines, genrePlugin);
            logger.info('outlineGen', formatDriftReport(driftResult));
            if (driftResult.hasDrift && attempt < DRIFT_MAX_RETRIES) { logger.warn('outlineGen', `补充大纲偏移检测失败 (attempt ${attempt + 1}/${DRIFT_MAX_RETRIES + 1}), 自动重试...`); continue; }
            const saved = await saveChapterOutlines(projectId, outlines);
            await ensureProjectQuests(projectId);
            return { outlines: saved, created: saved, count: saved.length, driftIssues: driftResult.issues };
        } catch (e) { return { outlines: [], created: [], count: 0, error: e.message }; }
    }
}

module.exports = { generateInitialMaterials, parseMarkdownOutlines, generateChapterOutlines, generateFromTemplate, supplementChapterOutlines };
