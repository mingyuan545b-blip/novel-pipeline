const { extractJSON } = require('../../jsonUtils');
const logger = require('../../../shared/logger');
const store = require('../../../store');
const { getHookBudgetForProject } = require('../../hookBudget');
const materialIndex = require('../../materialIndex');
const { extractAndPersist: extractTimeline } = require('../chapterTimelineExtractor');

async function syncForeshadowHooks(response, chapter, projectId) {
    try {
        const parsed = extractJSON(response);
        if (parsed?.foreshadowTracking && Array.isArray(parsed.foreshadowTracking)) {
            const hookBudget = getHookBudgetForProject(projectId);
            const allHooks = await hookBudget.getAllHooks();
            for (const ft of parsed.foreshadowTracking) {
                if (ft.status === '回收' || ft.status === '已回收' || ft.status === 'resolved') {
                    const matchHook = allHooks.find(h =>
                        (h.status === 'open' || h.status === 'active') &&
                        (h.notes?.includes(ft.name) || ft.name?.includes(h.type) || ft.detail?.includes(h.type))
                    );
                    if (matchHook) {
                        hookBudget.resolveHook(matchHook.id, chapter.chapterNumber, `素材管理员确认回收: ${ft.detail || ft.name}`);
                        logger.info('materialPostProc', `Hook ${matchHook.id} resolved by material-manager foreshadowTracking: ${ft.name}`);
                    }
                }
            }
        }

        const allUpdates = parsed?.updates || [];
        const recycleActions = allUpdates.filter(u => u.action === 'recycle' && u.type === 'foreshadowing');
        if (recycleActions.length > 0) {
            const hookBudget = getHookBudgetForProject(projectId);
            const allHooks = await hookBudget.getAllHooks();
            for (const ra of recycleActions) {
                const matchHook = allHooks.find(h =>
                    (h.status === 'open' || h.status === 'active') &&
                    (h.notes?.includes(ra.name) || ra.name?.includes(h.notes || ''))
                );
                if (matchHook) {
                    hookBudget.resolveHook(matchHook.id, chapter.chapterNumber, `素材管理员recycle操作: ${ra.name}`);
                    logger.info('materialPostProc', `Hook ${matchHook.id} resolved by recycle action: ${ra.name}`);
                }
            }
        }
    } catch (ftErr) {
        logger.warn('materialPostProc', 'Foreshadowtracking hook sync failed:', ftErr.message);
    }
}

function updateChapterStatus(chapter, response, saveAgentOutput) {
    chapter.status = 'material-updated';

    try {
        const parsedOutput = extractJSON(response);
        if (parsedOutput) {
            if (typeof parsedOutput.archiveLog === 'string') {
                parsedOutput.archiveLog = [parsedOutput.archiveLog];
            }
            if (typeof parsedOutput.foreshadowTracking === 'string') {
                parsedOutput.foreshadowTracking = [parsedOutput.foreshadowTracking];
            }
            chapter.materialManagerOutput = JSON.stringify(parsedOutput);
        } else {
            chapter.materialManagerOutput = response;
        }
    } catch (_) {
        chapter.materialManagerOutput = response;
    }

    chapter.updatedAt = new Date().toISOString();
}

async function saveChapter(chapter) {
    await store.setItem('chapters', chapter.id, chapter);
}

/**
 * 在章节完成后提取时间线事件和伏笔状态
 * @param {string} projectId
 * @param {object} chapter
 * @param {string} outlineText
 * @param {object} intentResult - 意图规划结果
 */
async function extractTimelineAndForeshadow(projectId, chapter, outlineText, intentResult) {
    try {
        await extractTimeline(projectId, chapter, outlineText, intentResult);
    } catch (e) {
        logger.warn('materialPostProc', `Timeline extraction failed for ch${chapter.chapterNumber}: ${e.message}`);
    }
}

function rebuildIndexes(projectId) {
    try {
        materialIndex.rebuildIndex(projectId);
        materialIndex.invalidateCache(projectId);
        logger.info('materialPostProc', 'Material indexes synced');
    } catch (idxErr) {
        logger.warn('materialPostProc', 'Index sync failed:', idxErr.message);
    }
}

module.exports = {
    syncForeshadowHooks,
    updateChapterStatus,
    saveChapter,
    extractTimelineAndForeshadow,
    rebuildIndexes
};
