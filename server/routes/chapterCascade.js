const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const { OUTPUT_DIR, AGENT_ROLE_NAMES, getChapterFileName } = require('../services/fileOutput');

async function cascadeCleanup(chapterId, projectId, chapterNumber, chapter) {
    const result = { success: [], errors: [] };

    const reviews = (await store.listItems('reviews')).filter(r => r.chapterId === chapterId);
    for (const r of reviews) {
        try { await store.deleteItem('reviews', r.id); }
        catch(err) { result.errors.push({ type: 'reviews', id: r.id, error: err.message || err }); }
    }
    result.success.push(`reviews: ${reviews.length}`);

    try { await store.deleteItem('pipeline-logs', `${chapterId}_pipeline`); result.success.push('pipelineLogs: 1'); }
    catch (err) { result.errors.push({ type: 'pipeline-logs', error: err.message || err }); }

    const audits = (await store.listItems('chapter-audits')).filter(a => a.chapterId === chapterId);
    for (const a of audits) {
        try { await store.deleteItem('chapter-audits', a.id); }
        catch(err) { result.errors.push({ type: 'chapter-audits', id: a.id, error: err.message || err }); }
    }
    result.success.push(`chapterAudits: ${audits.length}`);

    const snapshots = (await store.listItems('state-snapshots')).filter(s => s.projectId === projectId && s.chapterNumber === chapterNumber);
    for (const s of snapshots) {
        try { await store.deleteItem('state-snapshots', s.id); }
        catch(err) { result.errors.push({ type: 'state-snapshots', id: s.id, error: err.message || err }); }
    }
    result.success.push(`stateSnapshots: ${snapshots.length}`);

    const versionKeys = (await store.listItems('version-snapshots')).filter(v => v.projectId === projectId && v.chapterNumber === chapterNumber);
    for (const v of versionKeys) {
        try { await store.deleteItem('version-snapshots', v.id); }
        catch(err) { result.errors.push({ type: 'version-snapshots', id: v.id, error: err.message || err }); }
    }
    result.success.push(`versionSnapshots: ${versionKeys.length}`);

    const allMats = await store.listItems('materials');
    const materials = [];
    for (const m of allMats) {
        if (m.projectId === projectId && m.sourceChapter === chapterNumber && !(await store.isFoundationMaterial(m))) {
            materials.push(m);
        }
    }
    for (const m of materials) {
        try { await store.deleteItem('materials', m.id); }
        catch(err) { result.errors.push({ type: 'materials', id: m.id, error: err.message || err }); }
    }
    result.success.push(`materials: ${materials.length}`);

    try {
        const materialIndex = require('../services/materialIndex');
        const mi = new materialIndex();
        mi.removeChapterDiscoveries(projectId, chapterNumber);
        result.success.push('materialIndexCleaned');
    } catch (err) { result.errors.push({ type: 'materialIndex', error: err.message || err }); }

    let deletedFiles = 0;
    try {
        if (chapter) {
            const agentTypes = Object.keys(AGENT_ROLE_NAMES);
            const chaptersDir = path.join(OUTPUT_DIR, projectId, 'chapters');
            for (const type of agentTypes) {
                const fileName = getChapterFileName(chapter, type);
                const filePath = path.join(chaptersDir, fileName);
                if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); deletedFiles++; }
            }
            const finalDir = path.join(OUTPUT_DIR, projectId, 'final');
            const num = String(chapterNumber).padStart(2, '0');
            const title = (chapter.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 30);
            const finalFileName = `第${num}章 ${title}.txt`;
            const finalPath = path.join(finalDir, finalFileName);
            if (fs.existsSync(finalPath)) { fs.unlinkSync(finalPath); deletedFiles++; }
        }
    } catch(err) { result.errors.push({ type: 'outputFiles', error: err.message || err }); }
    result.success.push(`outputFiles: ${deletedFiles}`);

    try {
        const states = (await store.listItems('infinite-pipeline-state')).filter(s => s.projectId === projectId);
        for (const state of states) {
            let modified = false;
            if (state.currentChapterId === chapterId) { state.currentChapterId = null; state.currentChapterNumber = null; modified = true; }
            if (state.completedChapterIds) { const before = state.completedChapterIds.length; state.completedChapterIds = state.completedChapterIds.filter(id => id !== chapterId); if (state.completedChapterIds.length !== before) modified = true; }
            if (state.failedChapterIds) { const before = state.failedChapterIds.length; state.failedChapterIds = state.failedChapterIds.filter(id => id !== chapterId); if (state.failedChapterIds.length !== before) modified = true; }
            if (modified) await store.setItem('infinite-pipeline-state', state.id, state);
        }
        result.success.push('infiniteStateCleaned');
    } catch (err) { result.errors.push({ type: 'infiniteState', error: err.message || err }); }

    return result;
}

module.exports = { cascadeCleanup };
