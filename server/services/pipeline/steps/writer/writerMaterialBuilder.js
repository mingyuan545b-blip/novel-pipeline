/**
 * writerMaterialBuilder.js — 执笔素材构建器（P0重构版）
 * 完全使用调度器返回的结果，不再硬编码加载素材
 * 通过materialInjector统一注入层注入素材到user prompt
 */
const { getVolumeSubplane } = require('./writerShared');
const { scheduleMaterials } = require('../../agentMaterialScheduler');
const { injectMaterials } = require('../../materialInjector');
const { buildCharacterSection, buildNameLockSection, buildKnowledgeAccessSection } = require('./writerCharacterFormatter');

const MATERIAL_BUDGET = 8000;

async function buildMaterialSection(params) {
    const { projectId, chapter, materials, ctx, project, genre } = params;
    const styleProfile = await ctx.getStyleProfile();
    const outlineText = (chapter.outline || '').substring(0, 2000);

    const chapterScene = chapter.scene || '主世界';
    const volumeInfo = getVolumeSubplane(projectId, chapter.chapterNumber);
    const currentSubplaneId = volumeInfo ? volumeInfo.subplaneId : null;
    const isInSubplane = chapterScene !== '主世界' && chapterScene !== '';

    // 通过调度器加载所有素材（声明式，不再硬编码）
    const scheduled = await scheduleMaterials('writer', {
        projectId, chapter, materials, ctx, project, genre
    });

    // materialFocus过滤：按styleProfile.materialFocus.skip过滤不需要的素材类型
    // 根因修复：P0重构时丢失了此功能，调度器不处理materialFocus，需在此补回
    const materialFocus = await ctx.getMaterialFocus();
    const skipTypes = new Set(materialFocus.skip || []);
    if (skipTypes.size > 0) {
        for (const type of Object.keys(scheduled.materials)) {
            if (skipTypes.has(type)) {
                scheduled.materials[type] = [];
            }
        }
    }

    // 角色和限知由专用函数处理
    const scheduledChars = scheduled.materials.character || [];
    const characterRefSection = buildCharacterSection(scheduledChars, isInSubplane, currentSubplaneId);
    const nameLockSection = buildNameLockSection(scheduledChars, isInSubplane, currentSubplaneId);
    const knowledgeAccessSec = buildKnowledgeAccessSection(scheduled.materials['knowledge-access'] || []);

    // 其余素材通过统一注入层注入到materialSection
    const materialAgentContext = { content: '' };
    const injectResult = injectMaterials(scheduled, materialAgentContext, {
        agentType: 'writer',
        totalBudget: MATERIAL_BUDGET,
        isInSubplane,
        currentSubplaneId,
        chapterScene,
    });

    return {
        materialSection: materialAgentContext.content,
        characterRefSection,
        nameLockSection,
        knowledgeAccessSection: knowledgeAccessSec,
        styleProfile,
        outlineText,
        scheduled,
        injectStats: injectResult,
    };
}

module.exports = { buildMaterialSection };
