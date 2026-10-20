/**
 * 素材创建动作处理模块
 */
const logger = require('../../../shared/logger');
const { v4: uuidv4 } = require('uuid');
const { validateMaterial } = require('../../materialValidator');
const { validateNewMaterial } = require('../../genreConfig');
const { parseFlavorTag } = require('./materialFieldUtils');
const { ensureOutputDir } = require('./materialUpdateHelpers');
const { buildNewMaterialRecord, save } = require('../../materialRepository');
const { ORIGINS } = require('../../../config/materialProvenance');
const { populateCharacterFields, populateTypeSpecificFields, syncToRegistries } = require('./materialCreateHelpers');

function applyFlavorTags(material, content) {
    if (!content || typeof content !== 'string') return;
    const flavorTag = parseFlavorTag(content, /【风味标签】\s*(.+?)\s*\((轻度|中度|重度|light|medium|heavy)\)/);
    if (flavorTag) material.flavorTag = flavorTag;
}

async function handleCreateAction(update, chapter, projectId, styleProfile) {
    const materialType = update.type || 'misc';
    const validation = validateNewMaterial(materialType, update.name, update.content);
    if (!validation.valid) {
        logger.warn('materialCreate', `素材创建验证失败: "${update.name}"(${materialType}) - ${validation.reason}`);
        return null;
    }

    const protagonistName = styleProfile?.protagonistName || '';
    const genreId = String(styleProfile?.genre || styleProfile?.genreId || '');
    const newMatId = uuidv4();
    // T2：创建走唯一写入 API —— provenance（不可变出身）+ changeLog v2 + 留痕一次成对
    const newMaterial = buildNewMaterialRecord({
        id: newMatId, projectId, type: materialType, name: update.name,
        content: update.content || '',
        description: (update.content || '').substring(0, 200),
        chapter: chapter.chapterNumber || 0,
        origin: ORIGINS.CHAPTER,
        reason: update.reason || 'auto-created',
        tags: update.tags || ['auto-generated'],
        isLocked: false,
        extra: {
            parentPlane: update.parentPlane || null,
            parentFaction: update.parentFaction || null,
        },
    });

    if (materialType === 'character') await populateCharacterFields(newMaterial, update, chapter, projectId, protagonistName, genreId);
    populateTypeSpecificFields(newMaterial, update, chapter);
    applyFlavorTags(newMaterial, update.content);

    try {
        const matValidation = validateMaterial(newMaterial);
        if (!matValidation.valid) {
            logger.warn('materialCreate', `素材验证失败: "${update.name}" - ${matValidation.errors.join('; ')}`);
            for (const err of matValidation.errors) {
                const fieldMatch = err.match(/field\s+"(\w+)"/i);
                if (fieldMatch) newMaterial[fieldMatch[1]] = '';
            }
        }
    } catch (_) { logger.warn('materialCreate', '[material-actions]', _.message || _); }  // DEGRADE: 影响=validateMaterial 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    await save(newMaterial);
    await syncToRegistries(newMaterial, update, chapter, projectId, protagonistName);
    return { id: newMatId, type: materialType };
}

module.exports = { handleCreateAction, applyFlavorTags };
