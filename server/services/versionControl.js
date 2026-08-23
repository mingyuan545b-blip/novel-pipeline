const logger = require('../shared/logger');
const store = require('../store');
const { getDataContext } = require('./dataContext');

async function createVersionTag(projectId, chapterId, chapterNumber, version, content, commitMeta = {}) {
    const timestamp = Date.now();
    const tag = `ch${chapterNumber}_v${version}_${timestamp}`;

    const hookBudget = require('./hookBudget');
    const memory = require('./memory');

    let hookSnapshot = null;
    try {
        const hb = hookBudget.getHookBudgetForProject(projectId);
        const status = await hb.getBudgetStatus(chapterNumber);
        hookSnapshot = {
            activeHooks: status.active || 0,
            maxHooks: status.max || 0,
            staleDebt: status.staleDebt || 0
        };
    } catch (e) { logger.warn('versionControl', '[version-ctrl]', e.message || e); }

    let characterStateSnapshot = null;
    try {
        const mem = memory.getMemoryForProject(projectId);
        const l1 = mem.getLayer('L1');
        if (l1?.characterStates) {
            characterStateSnapshot = {};
            for (const [name, state] of Object.entries(l1.characterStates)) {
                characterStateSnapshot[name] = {
                    location: state.location || '',
                    status: state.status || '',
                    lastMentionedChapter: state.lastMentionedChapter || 0
                };
            }
        }
    } catch (e) { logger.warn('versionControl', '[version-ctrl]', e.message || e); }

    let memoryVersion = null;
    try {
        const _vcCtx = await getDataContext(projectId);
        const project = await _vcCtx.getProject();
        memoryVersion = project?._memoryVersion || 0;
    } catch (e) { logger.warn('versionControl', '[version-ctrl]', e.message || e); }

    const snapshot = {
        tag,
        projectId,
        chapterId,
        chapterNumber,
        version,
        content,
        contentLength: content?.length || 0,
        createdAt: new Date().toISOString(),
        commitTag: {
            hook_id: hookSnapshot,
            character_state_snapshot: characterStateSnapshot,
            memory_version: memoryVersion,
            branch: commitMeta.branch || 'main',
            parentTag: commitMeta.parentTag || null,
            reason: commitMeta.reason || 'auto-commit'
        }
    };

    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return null;

    if (!chapter._versionTags) chapter._versionTags = [];
    chapter._versionTags.push(tag);
    if (chapter._versionTags.length > 20) {
        const removedTags = chapter._versionTags.slice(0, chapter._versionTags.length - 20);
        chapter._versionTags = chapter._versionTags.slice(-20);
        for (const rt of removedTags) {
            try { await store.removeItem('version-snapshots', rt); } catch (e) { logger.warn('versionControl', '[version-ctrl]', e.message || e); }
        }
    }

    await store.setItem('chapters', chapterId, chapter);
    await store.setItem('version-snapshots', tag, snapshot);

    logger.info('versionControl', `[VERSION] Tag created: ${tag} (${snapshot.contentLength}字, branch=${commitMeta.branch || 'main'})`);
    return tag;
}

async function getVersionSnapshot(tag) {
    return await store.getItem('version-snapshots', tag);
}

async function listVersionTags(chapterId) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter?._versionTags) return [];
    return await Promise.all(chapter._versionTags.map(async tag => {
        const snap = await store.getItem('version-snapshots', tag);
        return snap ? {
            tag,
            version: snap.version,
            contentLength: snap.contentLength,
            createdAt: snap.createdAt,
            branch: snap.commitTag?.branch || 'main',
            reason: snap.commitTag?.reason || ''
        } : { tag };
    }));
}

async function rollbackToTag(chapterId, tag, rollbackMemory = true) {
    const snapshot = await store.getItem('version-snapshots', tag);
    if (!snapshot) return { success: false, error: `Tag ${tag} not found` };

    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter) return { success: false, error: 'Chapter not found' };

    const previousContent = chapter.content;
    chapter.content = snapshot.content;
    chapter.version = (chapter.version || 1) + 1;
    chapter.rolledBackFrom = tag;
    chapter.updatedAt = new Date().toISOString();

    if (!chapter._versionTags) chapter._versionTags = [];
    chapter._versionTags.push(`rollback_${tag}_${Date.now()}`);

    await store.setItem('chapters', chapterId, chapter);

    if (rollbackMemory && snapshot.commitTag?.character_state_snapshot) {
        logger.info('versionControl', `[VERSION] Memory snapshot available for tag ${tag}, manual restore may be needed`);
    }

    logger.info('versionControl', `[VERSION] Rollback: ${chapterId} -> ${tag} (from ${previousContent?.length || 0}字 to ${snapshot.contentLength}字)`);
    return {
        success: true,
        tag,
        previousContentLength: previousContent?.length || 0,
        newContentLength: snapshot.contentLength,
        commitTag: snapshot.commitTag
    };
}

async function findSafeRollbackPoint(chapterId) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter?._versionTags) return null;

    for (let i = chapter._versionTags.length - 1; i >= 0; i--) {
        const snap = await store.getItem('version-snapshots', chapter._versionTags[i]);
        if (snap?.commitTag?.branch === 'main' && snap?.commitTag?.reason === 'auto-commit') {
            return { tag: snap.tag, chapterNumber: snap.chapterNumber, version: snap.version };
        }
    }
    return null;
}

module.exports = { createVersionTag, getVersionSnapshot, listVersionTags, rollbackToTag, findSafeRollbackPoint };
