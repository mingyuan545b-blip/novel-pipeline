const store = require('../../store');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../shared/logger');
const { validateOutlineRhythm } = require('./outlineHelpers');

async function parseAndSaveOutlines(projectId, responseText, existingCount, supplementCount) {
    try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found in response');
        const jsonStr = match[0].replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
        const outlines = JSON.parse(jsonStr);

        const rhythmValidation = await validateOutlineRhythm(outlines, projectId);
        if (!rhythmValidation.isValid) {
            logger.error('outlineSupplementer', '[PIPELINE] 卷节奏校验失败！', { issues: rhythmValidation.issues });
            return { created: [], count: 0, error: `卷节奏校验失败：${rhythmValidation.issues.join('；')}`, rhythmIssues: rhythmValidation.issues };
        }

        const created = [];
        const allExistingTitles = (await store.queryItems('chapters', { projectId })).map(c => c.title).filter(Boolean);
        const allExistingOutlines = (await store.queryItems('chapters', { projectId })).map(c => (c.outline || '').substring(0, 80)).filter(Boolean);
        const usedTitles = new Set(allExistingTitles);
        const usedOutlineStarts = new Set(allExistingOutlines);

        for (const outline of outlines) {
            let title = outline.title || `第${existingCount + created.length + 1}章`;
            let dedupAttempts = 0;
            while (usedTitles.has(title) && dedupAttempts < 5) {
                dedupAttempts++;
                const suffix = dedupAttempts === 1 ? '（续）' : dedupAttempts === 2 ? '（下）' : dedupAttempts === 3 ? '（再续）' : `${dedupAttempts}）`;
                title = outline.title + suffix;
            }
            if (usedTitles.has(title)) continue;
            usedTitles.add(title);

            const outlineStart = (outline.outline || '').substring(0, 80);
            if (outlineStart && usedOutlineStarts.has(outlineStart)) continue;
            if (outlineStart) usedOutlineStarts.add(outlineStart);

            const id = uuidv4();
            const now = new Date().toISOString();
            const chapter = {
                id, projectId,
                chapterNumber: existingCount + created.length + 1,
                title, outline: outline.outline || '',
                scene: outline.scene || '', content: '',
                status: 'outlined', round: 0, wordCount: 0,
                createdAt: now, updatedAt: now
            };
            await store.setItem('chapters', id, chapter);
            created.push(chapter);

            const qId = uuidv4();
            await store.setItem('quests', qId, {
                id: qId, projectId, parentId: null,
                title: `第${chapter.chapterNumber}章 ${chapter.title}`,
                description: chapter.outline || '',
                status: 'planned', priority: 'normal',
                sortOrder: chapter.chapterNumber - 1,
                materialIds: [], chapterIds: [id],
                timelineEventIds: [], progress: 0, notes: '',
                tags: ['auto-generated'], createdAt: now, updatedAt: now
            });
        }

        const project = await store.getItem('projects', projectId);
        if (project) {
            project.currentChapter = existingCount + created.length;
            project.updatedAt = new Date().toISOString();
            await store.setItem('projects', projectId, project);
        }

        logger.info('outlineSupplementer', '[PIPELINE] created {count} new chapters', { count: created.length });
        return { created, count: created.length };
    } catch (e) {
        logger.error('outlineSupplementer', '[PIPELINE] parse error:', { message: e.message });
        return { created: [], count: 0, raw: responseText.substring(0, 500), error: e.message };
    }
}

module.exports = { parseAndSaveOutlines };
