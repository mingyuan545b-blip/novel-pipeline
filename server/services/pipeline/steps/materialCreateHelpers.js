/**
 * materialCreateHelpers - 素材创建辅助函数
 */
const logger = require('../../../shared/logger');
const entityRegistry = require('../../entityRegistry');
const itemDefinition = require('../../itemDefinition');
const entityCenter = require('../../entityCenter');
const { extractRoleLevelFromContent, extractGenreStateFromContent, extractFieldFromContent } = require('./materialFieldUtils');
const { extractCharacterStateFromContent } = require('../outlineResponseParser');
const { buildItemProperties } = require('../../itemStageParser');

async function populateCharacterFields(newMaterial, update, chapter, projectId, protagonistName, genreId) {
    newMaterial.roleLevel = extractRoleLevelFromContent(update.content, protagonistName, update.name) || update.roleLevel || 'npc';
    newMaterial.firstAppearChapter = chapter.chapterNumber || 0;
    newMaterial.lastAppearChapter = chapter.chapterNumber || 0;
    try {
        const parsed = extractCharacterStateFromContent(update.content || '', {});
        const entity = await entityCenter.getOrCreateEntity(projectId, 'character', update.name, {
            roleLevel: newMaterial.roleLevel, firstAppearChapter: newMaterial.firstAppearChapter,
            parentPlane: newMaterial.parentPlane, parentFaction: newMaterial.parentFaction,
            materialId: newMaterial.id,
            position: parsed.position || '', personality: parsed.personality || '',
            speakingTone: parsed.speakingTone || '', signatureDetail: parsed.signatureDetail || '',
            // 人物魅力系统4维度（参考蛊真人方源设计）
            charisma: parsed.charisma || '',
            philosophy: parsed.philosophy || '',
            quoteLibrary: Array.isArray(parsed.quoteLibrary) ? parsed.quoteLibrary : [],
            entranceDesign: parsed.entranceDesign || '',
            highlightScenes: Array.isArray(parsed.highlightScenes) ? parsed.highlightScenes : [],
            craftStyle: parsed.craftStyle || '',
            profile: {
                appearance: parsed.appearance || '', background: parsed.background || '',
                motivation: parsed.motivation || '', desire: parsed.desire || '',
                fear: parsed.fear || '', lie: parsed.lie || '', trauma: parsed.trauma || '',
                innerConflict: parsed.innerConflict || '', fateArc: parsed.fateArc || '',
            },
            sourceContent: (update.content || '').substring(0, 2000),
        });
        if (entity && entity.id !== newMaterial.id) {
            logger.info('materialCreate', `EntityCenter合并: "${update.name}"已存在entityId=${entity.id}，合并更新`);
            newMaterial.id = entity.id;
            newMaterial.entityId = entity.id;
            newMaterial.changeLog.push({ action: 'merged', reason: `合并到已有实体${entity.id}`, at: new Date().toISOString() });
        }
    } catch (entityErr) {
        logger.warn('materialCreate', `EntityCenter创建失败: ${entityErr.message}`);
    }
    if (genreId) {
        try {
            const genreState = extractGenreStateFromContent(update.content || '', genreId);
            if (Object.keys(genreState).length > 0) newMaterial.genreState = genreState;
        } catch (_) { logger.warn('materialCreate', '[material-actions]', _.message || _); }
    }
}

function populateTypeSpecificFields(newMaterial, update, chapter) {
    if (newMaterial.type === 'foreshadowing') {
        newMaterial.expectedRecoveryWindow = extractFieldFromContent(update.content, '预期回收窗口') || '';
        newMaterial.currentStatus = 'planted';
        newMaterial.importance = extractFieldFromContent(update.content, '重要程度') || 'normal';
    }
    if (newMaterial.type === 'famous-scene') {
        newMaterial.significance = extractFieldFromContent(update.content, '重要程度') || 'major';
    }
}

/** 需要生成item-definition的素材类型→defType映射 */
const DEFINITION_TYPES = {
    'equipment': 'equipment',
    'power-system': 'power-system',
    'technique': 'technique',
    'cultivation-method': 'cultivation-method'
};

async function syncToRegistries(newMaterial, update, chapter, projectId, protagonistName) {
    try {
        if (newMaterial.type === 'character') {
            await entityRegistry.registerEntity(projectId, newMaterial.type, update.name, {
                id: newMaterial.id,
                roleLevel: extractRoleLevelFromContent(update.content, protagonistName, update.name) || update.roleLevel || 'npc',
                firstAppearChapter: chapter.chapterNumber || 0, lastAppearChapter: chapter.chapterNumber || 0,
                parentPlane: newMaterial.parentPlane || null, parentFaction: newMaterial.parentFaction || null
            });
        }
        const defType = DEFINITION_TYPES[newMaterial.type];
        if (defType) {
            const content = update.content || '';
            await itemDefinition.createDefinition(projectId, defType, update.name, {
                id: `def-${defType}-${newMaterial.id}`, briefDesc: content.substring(0, 100),
                summaryDesc: content.substring(0, 300), detailDesc: content.substring(0, 800),
                propertiesJson: buildItemProperties(content), materialId: newMaterial.id,
                sourceChapter: chapter.chapterNumber || null
            });
        }
    } catch (syncErr) {
        logger.warn('materialCreate', 'Entity registry sync failed for new material:', syncErr.message);
    }
}

module.exports = { populateCharacterFields, populateTypeSpecificFields, syncToRegistries };
