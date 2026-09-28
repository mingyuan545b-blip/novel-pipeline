/**
 * 素材创建动作处理模块
 */
const logger = require('../../../shared/logger');
const store = require('../../../store');
const { v4: uuidv4 } = require('uuid');
const { validateMaterial } = require('../../materialValidator');
const { validateNewMaterial } = require('../../genreConfig');
const { parseFlavorTag } = require('./materialFieldUtils');
const { ensureOutputDir } = require('./materialUpdateHelpers');
const { buildWriteStamp } = require('../../../config/materialWriteOwnership');
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
    const newMaterial = {
        id: newMatId, projectId, type: materialType, name: update.name,
        description: (update.content || '').substring(0, 200),
        initialContent: update.content || '', currentContent: update.content || '',
        sourceChapter: chapter.chapterNumber || 0,
        tags: update.tags || ['auto-generated'], version: 1,
        changeLog: [{ action: 'created', reason: update.reason || 'auto-created', at: new Date().toISOString() }],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        parentPlane: update.parentPlane || null, parentFaction: update.parentFaction || null,
        isLocked: false,
        // P1-4c 写入留痕：谁写的、哪一章写的（materials 只有 material-manager 链可写）
        ...buildWriteStamp(chapter.chapterNumber),
    };

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
    } catch (_) { logger.warn('materialCreate', '[material-actions]', _.message || _); }

    await store.setItem('materials', newMatId, newMaterial);
    await syncToRegistries(newMaterial, update, chapter, projectId, protagonistName);
    return { id: newMatId, type: materialType };
}

module.exports = { handleCreateAction, applyFlavorTags };
