/**
 * chapterPlanRefresh — P1-4b 就近细纲刷新
 *
 * 背景：远景规划一次覆盖 N 章，后续章节的素材还没长出来，粗纲里写死的细节必然与
 * 未来素材冲突（用户反馈"前面设定都不同"的根因之一）。因此把大纲拆两档：
 *   - 远景粗纲（outlineGenerator scope='far'）：只定主线走向/冲突/钩子/实体名字；
 *   - 就近细纲（本模块）：**开写前**这一步，用"此刻已归档的最新素材 + 上一章正文"
 *     把本章粗纲细化为可直接开写的计划。素材是唯一真相，冲突以素材为准。
 *
 * 单一职责：只做"本章计划的刷新"，不碰其它章节、不写素材、不改章节状态。
 * 幂等：outlineRefinedChapter === 本章号 → 直接跳过（重跑不重复调 LLM、不重复计费）。
 * 失败不阻断：LLM 失败保留粗纲并打 outlineRefineFailed 标记，交门槛/体检面板暴露。
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const llm = require('../llm');
const { getOutlineApiConfig } = require('./constants');
const { getVisibleMaterials } = require('./volumeHelpers');
const { buildConstraintInjection } = require('../prompts/constraintInjector');
const { buildStyleInjection } = require('../prompts/styleInjector');
const { buildNearOutlineSystemPrompt } = require('./outlineTemplateBuilder');
const { parseTemplateResponse } = require('./outlineResponseParser');
const { detectOutlineDrift, formatDriftReport } = require('./outlineDriftGuard');
const { getGenrePlugin, resolveGenreFromProject } = require('../genreConfig');

const MAX_MATERIALS = 40;
const MATERIAL_EXCERPT = 200;
const PREV_EXCERPT = 800;
const NEAR_OUTLINE_MAX_TOKENS = 4096;

/** 按章号取章节（带 chapterId 时直接读，避免全表扫描） */
async function loadChapter(projectId, chapterNumber, chapterId) {
    if (chapterId) return store.getItem('chapters', chapterId);
    const chapters = await store.queryItems('chapters', { projectId });
    return chapters.find(c => c.chapterNumber === chapterNumber) || null;
}
/** 素材名录（含内容摘要）：就近细纲要"以素材为准"，所以给内容而不只是名字 */
async function buildMaterialDigest(projectId, chapterNumber) {
    const vis = await getVisibleMaterials(projectId, chapterNumber, { purpose: 'writer' });
    return (vis.materials || []).slice(0, MAX_MATERIALS)
        .map(m => `[${m.type}] ${m.name}: ${(m.currentContent || '').replace(/\s+/g, ' ').substring(0, MATERIAL_EXCERPT)}`)
        .join('\n');
}

/** 上一章正文节选：给模型衔接锚点（开篇承接、人物状态） */
async function buildPrevExcerpt(projectId, chapterNumber) {
    if (chapterNumber <= 1) return '';
    const chapters = await store.queryItems('chapters', { projectId });
    const prev = chapters.find(c => c.chapterNumber === chapterNumber - 1);
    const text = (prev?.content || '').replace(/\s+/g, ' ');
    if (!text) return '';
    return `上一章（第${chapterNumber - 1}章）正文节选：\n${text.substring(Math.max(0, text.length - PREV_EXCERPT))}`;
}

async function buildMessages(projectId, chapterNumber, farOutline) {
    const project = await store.getItem('projects', projectId);
    const genre = resolveGenreFromProject(project);
    const constraintInjection = await buildConstraintInjection(projectId, 'outline');
    const styleInjection = await buildStyleInjection(projectId);
    const systemPrompt = buildNearOutlineSystemPrompt(constraintInjection, styleInjection, chapterNumber);
    const materialDigest = await buildMaterialDigest(projectId, chapterNumber);
    const prevExcerpt = await buildPrevExcerpt(projectId, chapterNumber);
    const userContent = [
        `小说：${project?.name || ''}（${project?.genre || ''}）`,
        `【第${chapterNumber}章远景粗纲】\n${farOutline}`,
        `【此刻已归档素材】\n${materialDigest || '（暂无）'}`,
        prevExcerpt,
    ].filter(Boolean).join('\n\n');
    return { messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], genre };
}
/** 细纲落盘：保留粗纲到 farOutline（幂等，只写一次），正文计划换成细纲 */
async function persistRefine(chapter, chapterNumber, refined, driftIssues) {
    if (!chapter.farOutline) chapter.farOutline = chapter.outline || '';
    chapter.title = refined.title || chapter.title;
    chapter.outline = refined.outline;
    chapter.outlineRefinedChapter = chapterNumber;
    chapter.outlineRefinedAt = new Date().toISOString();
    chapter.outlineAdjust = refined.adjust || '';
    delete chapter.outlineRefineFailed;
    if (driftIssues && driftIssues.length > 0) {
        chapter.outlineRefineDrift = driftIssues;
        logger.warn('chapterPlanRefresh', `第${chapterNumber}章细纲题材偏移告警：${driftIssues.length}项`);
    } else delete chapter.outlineRefineDrift;
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);
}

/**
 * 刷新本章就近细纲（幂等）
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {{chapterId?: string, force?: boolean, onStep?: Function}} [options]
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, title?: string, outline?: string, adjust?: string, driftIssues?: Array, error?: string}>}
 */
async function refreshNearOutline(projectId, chapterNumber, options = {}) {
    const chapter = await loadChapter(projectId, chapterNumber, options.chapterId);
    if (!chapter) return { ok: false, reason: 'chapter-not-found' };
    if (chapter.outlineRefinedChapter === chapterNumber && !options.force) return { ok: true, skipped: true, outline: chapter.outline };
    const farOutline = chapter.farOutline || chapter.outline || '';
    if (!farOutline.trim()) return { ok: false, reason: 'no-outline' };
    if (typeof options.onStep === 'function') options.onStep({ step: 'near-outline', status: 'running', summary: `第${chapterNumber}章就近细纲细化中…` });

    try {
        const { messages, genre } = await buildMessages(projectId, chapterNumber, farOutline);
        const result = await llm.chat(messages, { maxTokens: NEAR_OUTLINE_MAX_TOKENS, temperature: 0.7, apiConfig: await getOutlineApiConfig() });
        const responseText = result.choices?.[0]?.message?.content || '';
        const refined = parseTemplateResponse(responseText);
        if (!refined || !refined.outline) throw new Error('细纲响应缺少 outline 字段');
        const driftResult = detectOutlineDrift([{ chapterNumber, title: refined.title, outline: refined.outline }], getGenrePlugin(genre));
        logger.info('chapterPlanRefresh', formatDriftReport(driftResult));
        await persistRefine(chapter, chapterNumber, refined, driftResult.hasDrift ? driftResult.issues : null);
        if (typeof options.onStep === 'function') options.onStep({ step: 'near-outline', status: 'passed', summary: `第${chapterNumber}章就近细纲已刷新${refined.adjust ? `（与粗纲差异：${refined.adjust}）` : ''}` });
        logger.info('chapterPlanRefresh', `第${chapterNumber}章就近细纲已刷新，${refined.outline.length}字`);
        return { ok: true, title: chapter.title, outline: chapter.outline, adjust: refined.adjust || '', driftIssues: driftResult.issues || [] };
    } catch (e) {
        // 失败不阻断：保留粗纲继续开写，但留下故障锚点（谁在哪一步坏了能一眼定位）
        chapter.outlineRefineFailed = `[就近细纲刷新失败] ${e.message}`;
        chapter.updatedAt = new Date().toISOString();
        try { await store.setItem('chapters', chapter.id, chapter); } catch (persistErr) { logger.warn('chapterPlanRefresh', `失败标记落盘失败: ${persistErr.message}`); }  // DEGRADE: 影响=store.setItem 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        logger.error('chapterPlanRefresh', `第${chapterNumber}章就近细纲刷新失败，保留远景粗纲开写: ${e.message}`, { chapterNumber });
        if (typeof options.onStep === 'function') options.onStep({ step: 'near-outline', status: 'warning', summary: `第${chapterNumber}章就近细纲刷新失败，改用远景粗纲：${e.message}` });
        return { ok: false, error: e.message, keptFar: true };
    }
}

module.exports = { refreshNearOutline };
