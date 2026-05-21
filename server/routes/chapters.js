const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const { saveFinalContent } = require('../services/pipeline');
const { OUTPUT_DIR, AGENT_ROLE_NAMES, getChapterFileName } = require('../services/fileOutput');
const { createChapter, updateChapter, chapterIdParam } = require('../middleware/validators');

const router = require('express').Router();

function cascadeCleanup(chapterId, projectId, chapterNumber, chapter) {
    const result = {};

    const reviews = store.listItems('reviews').filter(r => r.chapterId === chapterId);
    for (const r of reviews) { try { store.deleteItem('reviews', r.id); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    result.reviews = reviews.length;

    try { store.deleteItem('pipeline-logs', `${chapterId}_pipeline`); result.pipelineLogs = 1; } catch (_) { result.pipelineLogs = 0; }

    const audits = store.listItems('chapter-audits').filter(a => a.chapterId === chapterId);
    for (const a of audits) { try { store.deleteItem('chapter-audits', a.id); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    result.chapterAudits = audits.length;

    const snapshots = store.listItems('state-snapshots').filter(s => s.projectId === projectId && s.chapterNumber === chapterNumber);
    for (const s of snapshots) { try { store.deleteItem('state-snapshots', s.id); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    result.stateSnapshots = snapshots.length;

    const versionKeys = store.listItems('version-snapshots').filter(v => v.projectId === projectId && v.chapterNumber === chapterNumber);
    for (const v of versionKeys) { try { store.deleteItem('version-snapshots', v.id); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    result.versionSnapshots = versionKeys.length;

    const materials = store.listItems('materials').filter(m =>
        m.projectId === projectId && m.sourceChapter === chapterNumber && !store.isFoundationMaterial(m)
    );
    for (const m of materials) { try { store.deleteItem('materials', m.id); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); } }
    result.materials = materials.length;

    try {
        const materialIndex = require('../services/materialIndex');
        const mi = new materialIndex();
        mi.removeChapterDiscoveries(projectId, chapterNumber);
        result.materialIndexCleaned = true;
    } catch (_) { result.materialIndexCleaned = false; }

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
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    result.outputFiles = deletedFiles;

    try {
        const states = store.listItems('infinite-pipeline-state').filter(s => s.projectId === projectId);
        for (const state of states) {
            let modified = false;
            if (state.currentChapterId === chapterId) {
                state.currentChapterId = null;
                state.currentChapterNumber = null;
                modified = true;
            }
            if (state.completedChapterIds) {
                const before = state.completedChapterIds.length;
                state.completedChapterIds = state.completedChapterIds.filter(id => id !== chapterId);
                if (state.completedChapterIds.length !== before) modified = true;
            }
            if (state.failedChapterIds) {
                const before = state.failedChapterIds.length;
                state.failedChapterIds = state.failedChapterIds.filter(id => id !== chapterId);
                if (state.failedChapterIds.length !== before) modified = true;
            }
            if (modified) store.setItem('infinite-pipeline-state', state.id, state);
        }
        result.infiniteStateCleaned = true;
    } catch (_) { result.infiniteStateCleaned = false; }

    return result;
}

router.get('/', (req, res) => {
    const { projectId, status } = req.query;
    let chapters = store.listItems('chapters');
    if (projectId) chapters = chapters.filter(c => c.projectId === projectId);
    if (status) chapters = chapters.filter(c => c.status === status);
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    res.json(chapters);
});

router.post('/', createChapter, async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const chapter = {
        id,
        projectId: req.body.projectId,
        chapterNumber: req.body.chapterNumber || 1,
        title: req.body.title || `Chapter ${req.body.chapterNumber || 1}`,
        outline: req.body.outline || '',
        content: req.body.content || '',
        status: req.body.status || 'outlined',
        wordCount: req.body.content ? req.body.content.length : 0,
        round: req.body.round || 1,
        writerOutput: req.body.writerOutput || '',
        firstReviewOutput: req.body.firstReviewOutput || '',
        secondReviewOutput: req.body.secondReviewOutput || '',
        finalEditorOutput: req.body.finalEditorOutput || '',
        history: [],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('chapters', id, chapter);
    res.status(201).json(chapter);
});

router.post('/:id/reset', async (req, res) => {
    const chapter = store.getItem('chapters', req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const chapterId = chapter.id;
    const projectId = chapter.projectId;
    const chapterNumber = chapter.chapterNumber;
    const cascade = cascadeCleanup(chapterId, projectId, chapterNumber, chapter);

    chapter.status = 'outlined';
    chapter._reviewRounds = 0;
    chapter._wordCountRetry = 0;
    chapter._skipReason = undefined;
    chapter.round = 0;
    chapter.wordCount = 0;
    chapter.content = '';
    chapter.writerOutput = '';
    chapter.firstReviewOutput = '';
    chapter.secondReviewOutput = '';
    chapter.finalEditorOutput = '';
    chapter.materialManagerOutput = '';
    chapter.history = [];
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);

    console.log(`[CHAPTERS] Reset chapter ${chapterNumber} (id=${chapterId}):`, JSON.stringify(cascade));
    res.json({ success: true, resetChapter: chapterId, cascade });
});

router.get('/:id', (req, res) => {
    const chapter = store.getItem('chapters', req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    res.json(chapter);
});

router.put('/:id', updateChapter, async (req, res) => {
    const chapter = store.getItem('chapters', req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
    const updated = {
        ...chapter,
        ...req.body,
        id: chapter.id,
        wordCount: req.body.content ? req.body.content.length : chapter.wordCount,
        updatedAt: new Date().toISOString()
    };
    if (req.body.content && req.body.content !== chapter.content) {
        updated.history = [...(chapter.history || []), {
            content: chapter.content,
            timestamp: new Date().toISOString(),
            round: chapter.round
        }];
    }
    await store.setItem('chapters', chapter.id, updated);
    if (updated.status === 'approved' && req.body.content) {
        try { saveFinalContent(updated.projectId, updated); } catch (e) { console.warn('[CHAPTERS] Failed to update final content:', e.message); }
    }
    res.json(updated);
});

router.delete('/:id', (req, res) => {
    const chapter = store.getItem('chapters', req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const chapterId = req.params.id;
    const projectId = chapter.projectId;
    const chapterNumber = chapter.chapterNumber;
    const cascade = cascadeCleanup(chapterId, projectId, chapterNumber, chapter);

    store.deleteItem('chapters', chapterId);

    console.log(`[CHAPTERS] Cascade delete chapter ${chapterNumber} (id=${chapterId}):`, JSON.stringify(cascade));
    res.json({ success: true, deletedChapter: chapterId, cascade });
});

router.get('/download-novel/:projectId', (req, res) => {
    const { projectId } = req.params;
    const project = store.getItem('projects', projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const chapters = store.listItems('chapters')
        .filter(c => c.projectId === projectId && (c.status === 'material-updated' || c.status === 'approved'))
        .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

    if (chapters.length === 0) {
        return res.status(404).json({ error: 'No completed chapters to download' });
    }

    const lines = [];
    lines.push(`${project.name || 'Untitled'}\n`);

    for (const ch of chapters) {
        const title = ch.title || `第${ch.chapterNumber}章`;
        lines.push(`${'='.repeat(40)}`);
        lines.push(`${title}`);
        lines.push(`${'='.repeat(40)}\n`);

        const content = ch.polishedContent || ch.content || ch.writerOutput || '';
        if (content) {
            lines.push(content);
        } else {
            lines.push('[内容缺失]');
        }
        lines.push('\n');
    }

    const novelText = lines.join('\n');
    const filename = `${project.name || 'novel'}_全${chapters.length}章.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send('\ufeff' + novelText);
});

module.exports = router;
