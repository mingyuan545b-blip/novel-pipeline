const router = require('express').Router();
const { resetChapterContent, clearChaptersAfter } = require('../../middleware/validators');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

const RESET_FIELDS_FULL = ['content', 'writerOutput', 'reviserOutput', 'intentPlannerOutput',
    'firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'polisherOutput',
    'readerOutput', 'materialManagerOutput'];

const RESET_FIELDS_BULK = ['content', 'writerOutput', 'firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'materialManagerOutput'];

router.post('/reset-chapter-content', resetChapterContent, async (req, res) => {
    const { projectId, chapterId, chapterNumber } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const store = require('../../store');

    let chapters;
    if (chapterId) {
        chapters = [await store.getItem('chapters', chapterId)].filter(Boolean);
    } else if (chapterNumber) {
        chapters = (await store.queryItems('chapters', { projectId })).filter(c => c.chapterNumber === chapterNumber);
    } else {
        return res.apiError(VALIDATION_ERROR.statusCode, 'chapterId or chapterNumber is required', VALIDATION_ERROR.code);
    }

    let resetCount = 0;
    for (const ch of chapters) {
        ch.status = 'outlined';
        for (const field of RESET_FIELDS_FULL) ch[field] = '';
        ch.round = 0;
        ch.wordCount = 0;
        ch.skipUntil = undefined;
        ch._pipelineRetries = 0;
        ch._wordCountRetry = 0;
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, ch);
        try { await store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch (_) { /* silent */ }
        resetCount++;
    }

    res.json({ success: true, resetCount, message: `已重置${resetCount}章的正文（大纲保留）` });
});

router.post('/reset-chapters-bulk', async (req, res) => {
    const { projectId, fromChapter, toChapter } = req.body;
    if (!projectId || !fromChapter || !toChapter) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, fromChapter, toChapter are required', VALIDATION_ERROR.code);
    const store = require('../../store');

    const chapters = (await store.queryItems('chapters', { projectId }))
        .filter(c => c.chapterNumber >= fromChapter && c.chapterNumber <= toChapter);

    let resetCount = 0;
    for (const ch of chapters) {
        ch.status = 'outlined';
        for (const field of RESET_FIELDS_BULK) ch[field] = '';
        ch.round = 0;
        ch.wordCount = 0;
        ch.skipUntil = undefined;
        ch._pipelineRetries = 0;
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, ch);
        try { await store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch (_) { /* silent */ }
        resetCount++;
    }

    res.json({ success: true, resetCount, message: `已重置第${fromChapter}-${toChapter}章的正文（大纲保留）` });
});

router.get('/outlines/:projectId', async (req, res) => {
    try {
        const store = require('../../store');
        const { projectId } = req.params;
        const chapterOutlines = await store.queryItems('chapter-outlines', { projectId });
        const materialOutlines = (await store.queryItems('materials', { projectId })).filter(m => m.type === 'chapter-outline');
        const all = [...chapterOutlines];
        const existingNums = new Set(chapterOutlines.map(o => o.chapterNumber));
        for (const m of materialOutlines) {
            const num = m.chapterNumber || m.metadata?.chapterNumber;
            if (num && !existingNums.has(num)) all.push(m);
        }
        all.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
        res.json({ success: true, data: all, count: all.length });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/clear-chapters-after/:projectId', clearChaptersAfter, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { afterChapter } = req.body;
        const store = require('../../store');
        const chapters = (await store.queryItems('chapters', { projectId }))
            .filter(c => c.chapterNumber > afterChapter);

        let deletedCount = 0;
        for (const ch of chapters) {
            await store.deleteItem('chapters', ch.id);
            try { await store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch (_) { /* silent */ }
            deletedCount++;
        }

        const materials = (await store.queryItems('materials', { projectId }))
            .filter(m => m.sourceChapter > afterChapter);
        let matDeleted = 0;
        for (const m of materials) {
            if (!m.isLocked) {
                await store.deleteItem('materials', m.id);
                matDeleted++;
            }
        }

        res.json({ success: true, deletedChapters: deletedCount, deletedMaterials: matDeleted });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
