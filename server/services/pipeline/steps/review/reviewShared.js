const { v4: uuidv4 } = require('uuid');
const store = require('../../../../store');
const { detectModernSlang, detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectCrossChapterRepetition, detectTellVerbs, calcInfoDripScore, extractEndingTension, detectCharacterNameMismatch } = require('../../../contentUtils');
const { resolveConfig } = require('../../../../config');
const { extractJSON } = require('../../../jsonUtils');
const { scanContent: scanSensitiveWords } = require('../../../sensitiveWordGuard');
const { detectGenre, resolveGenreFromProject, getGenrePerspectiveSchema, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept } = require('../../../genreConfig');
const { getMetrics } = require('../../../metricsCollector');
const reviewRemediation = require('../../../reviewRemediation');
const { ValidationEngine } = require('../../../validationEngine');
const { getDataContext } = require('../../../dataContext');
const { truncateForReview, truncateReviewOutput } = require('../../../contextTruncator');
const { checkWordCountGate } = require('./wordCountGate');
const { scheduleMaterials } = require('../../agentMaterialScheduler');
const { buildCharacterByFormat, buildKnowledgeAccessSection, SECTION_BUILDERS } = require('../../materialInjector');
const { mergeWithArchivedForeshadows } = require('../foreshadowArchiveLoader');

/**
 * 通过调度器加载审核Agent的实体数据
 * 替代各review文件中重复的ctx.getEntitiesForReviewer硬编码
 * 素材段构建统一通过materialInjector处理（声明式差异配置：characterFormat='review', foreshadowFilter='all'）
 *
 * 伏笔全量加载策略（修复Phase 3引新bug）：
 * 调度器默认只加载未archived素材（向后兼容），但审核员需要看全量伏笔状态（含已回收）
 * 通过foreshadowArchiveLoader合并archived伏笔，不影响其他Agent的调度器行为
 *
 * @param {string} agentType - 'first-review'|'second-review'|'fast-review'
 * @param {string} projectId
 * @param {object} chapter
 * @param {object} ctx
 * @param {object} project
 * @returns {object} { entitySection, foreshadowSection, knowledgeAccessSection, scheduledChars, constraints }
 */
async function loadReviewEntityData(agentType, projectId, chapter, ctx, project) {
    const genre = resolveGenreFromProject(project);
    let materials = [];
    try { materials = await ctx.getMaterials(); } catch (_) { /* fallback: empty */ }
    const scheduled = await scheduleMaterials(agentType, {
        projectId, chapter, materials, ctx, project, genre
    });
    const scheduledChars = scheduled.materials.character || [];

    // 角色段：通过声明式配置（characterFormat='review'）自动选择buildCharacterReviewSection
    const entitySection = buildCharacterByFormat(scheduledChars, agentType, '审核依据');

    // 伏笔段：合并未archived（调度器）+ archived（DataContext）的伏笔，显示全量状态
    const activeForeshadowItems = scheduled.materials.foreshadowing || [];
    const allForeshadowItems = await mergeWithArchivedForeshadows(activeForeshadowItems, ctx);
    const foreshadowSection = SECTION_BUILDERS.foreshadowing(allForeshadowItems, { foreshadowFilter: 'all' });

    // 限知约束段：直接调用buildKnowledgeAccessSection
    const accessItems = scheduled.materials['knowledge-access'] || [];
    const knowledgeAccessSection = buildKnowledgeAccessSection(accessItems);

    return { entitySection, foreshadowSection, knowledgeAccessSection, scheduledChars, constraints: scheduled.constraints };
}

module.exports = {
    uuidv4, store, detectModernSlang, detectAdultPerspective, detectTechJargon,
    detectPipelineMetadataLeak, detectCrossChapterRepetition, detectTellVerbs,
    calcInfoDripScore, extractEndingTension, detectCharacterNameMismatch,
    resolveConfig, extractJSON, scanSensitiveWords, detectGenre, resolveGenreFromProject,
    getGenrePerspectiveSchema, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept,
    getMetrics, reviewRemediation, ValidationEngine, getDataContext,
    truncateForReview, truncateReviewOutput, checkWordCountGate,
    loadReviewEntityData,
};
