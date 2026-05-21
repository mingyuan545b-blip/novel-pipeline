const { extractJSON } = require('../../jsonUtils');
const store = require('../../../store');
const { getHookBudgetForProject } = require('../../hookBudget');
const materialIndex = require('../../materialIndex');

function syncForeshadowHooks(response, chapter, projectId) {
    try {
        const parsed = extractJSON(response);
        if (parsed?.foreshadowTracking && Array.isArray(parsed.foreshadowTracking)) {
            const hookBudget = getHookBudgetForProject(projectId);
            for (const ft of parsed.foreshadowTracking) {
                if (ft.status === '回收' || ft.status === '已回收' || ft.status === 'resolved') {
                    const allHooks = hookBudget.getAllHooks();
                    const matchHook = allHooks.find(h =>
                        (h.status === 'open' || h.status === 'active') &&
                        (h.notes?.includes(ft.name) || ft.name?.includes(h.type) || ft.detail?.includes(h.type))
                    );
                    if (matchHook) {
                        hookBudget.resolveHook(matchHook.id, chapter.chapterNumber, `素材管理员确认回收: ${ft.detail || ft.name}`);
                        console.log(`[PIPELINE] Hook ${matchHook.id} resolved by material-manager foreshadowTracking: ${ft.name}`);
                    }
                }
            }
        }
    } catch (ftErr) {
        console.warn('[PIPELINE] Foreshadowtracking hook sync failed:', ftErr.message);
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

function rebuildIndexes(projectId) {
    try {
        materialIndex.rebuildIndex(projectId);
        materialIndex.invalidateCache(projectId);
        console.log('[PIPELINE] Material indexes synced');
    } catch (idxErr) {
        console.warn('[PIPELINE] Index sync failed:', idxErr.message);
    }
}

module.exports = {
    syncForeshadowHooks,
    updateChapterStatus,
    saveChapter,
    rebuildIndexes
};
