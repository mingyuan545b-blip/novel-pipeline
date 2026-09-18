/**
 * 素材更新/归档动作处理模块
 * 创建动作已拆分到materialCreateAction.js
 */

const logger = require('../../../shared/logger');
const store = require('../../../store');
const entityCenter = require('../../entityCenter');
const { extractRoleLevelFromContent, extractGenreStateFromContent } = require('./materialFieldUtils');
const { extractCharacterStateFromContent } = require('../outlineResponseParser');
const { handleCreateAction } = require('./materialCreateAction');

/**
 * 计算更新后的 currentContent：
 *   角色类走"合并模式"（保留人设标签，只覆盖状态类标签），避免章节状态把人设冲掉
 *   （陷阱清单 P0；配置见 config/materialContentPolicy）
 * 合并失败时回退为原行为（update.content || existing.currentContent）。
 */
function resolveCurrentContent(update, existing) {
    const { MATERIAL_CONTENT_POLICY } = require('../../../config/materialContentPolicy');
    if (!update.content) return existing.currentContent;
    if (!MATERIAL_CONTENT_POLICY.mergeTypes.includes(existing.type)) return update.content;
    const { mergeMaterialContent } = require('./materialContentMerger');
    const merged = mergeMaterialContent(existing.currentContent, update.content);
    return merged || update.content;
}

async function handleUpdateAction(update, existing, chapter, projectId, styleProfile) {
    if (!existing || !existing.id) return false;

    const protagonistName = styleProfile?.protagonistName || '';
    const genreId = String(styleProfile?.genre || styleProfile?.genreId || '');

    const updatedMaterial = {
        ...existing,
        currentContent: resolveCurrentContent(update, existing),
        sourceChapter: chapter.chapterNumber || existing.sourceChapter,
        lastAppearChapter: chapter.chapterNumber || existing.lastAppearChapter,
        version: (existing.version || 1) + 1,
        updatedAt: new Date().toISOString()
    };

    if (existing.type === 'character') {
        try {
            const parsed = extractCharacterStateFromContent(update.content || '', {});
            await entityCenter.getOrCreateEntity(projectId, 'character', existing.name, {
                roleLevel: existing.roleLevel,
                lastAppearChapter: existing.lastAppearChapter,
                parentPlane: existing.parentPlane, parentFaction: existing.parentFaction,
                materialId: existing.id,
                position: parsed.position || existing.position || '',
                personality: parsed.personality || existing.personality || '',
                speakingTone: parsed.speakingTone || existing.speakingTone || '',
                signatureDetail: parsed.signatureDetail || existing.signatureDetail || '',
                sourceContent: (update.content || existing.content || '').substring(0, 2000),
            });
        } catch (entityErr) {
            logger.warn('materialActions', `EntityCenter更新失败: ${entityErr.message}`);
        }
        if (genreId) {
            try {
                const genreState = extractGenreStateFromContent(update.content || '', genreId);
                if (Object.keys(genreState).length > 0) updatedMaterial.genreState = genreState;
            } catch (_) { logger.warn('materialActions', '[material-actions]', _.message || _); }
        }
    }

    if (existing.type === 'foreshadowing') {
        if (update.content?.includes('已回收') || update.content?.includes('已揭示')) {
            updatedMaterial.currentStatus = 'resolved';
        }
    }

    updatedMaterial.changeLog = [
        ...(existing.changeLog || []),
        { action: 'updated', reason: update.reason || 'auto-updated', at: new Date().toISOString() }
    ];

    await store.setItem('materials', existing.id, updatedMaterial);
    return true;
}

async function handleArchiveAction(update, existing, chapter, projectId) {
    if (!existing || !existing.id) return false;
    const archived = {
        ...existing, archived: true, archivedAt: new Date().toISOString(),
        archivedReason: update.reason || 'auto-archived',
        version: (existing.version || 1) + 1, updatedAt: new Date().toISOString()
    };
    await store.setItem('materials', existing.id, archived);
    return true;
}

module.exports = { handleCreateAction, handleUpdateAction, handleArchiveAction };
