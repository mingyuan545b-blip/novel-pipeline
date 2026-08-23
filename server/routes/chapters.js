const { v4: uuidv4 } = require('uuid');
const logger = require('../shared/logger');
const store = require('../store');
const { saveFinalContent } = require('../services/pipeline');
const { createChapter, updateChapter, chapterIdParam, projectIdParam } = require('../middleware/validators');
const { cascadeCleanup } = require('./chapterCascade');
const { ERROR_CODES } = require('../shared/errorCodes');
const { isCompletedOrApproved, STATUS_VALUES } = require('../services/chapterStatus');

const { NOT_FOUND } = ERROR_CODES;

const router = require('express').Router();

router.get('/', async (req, res) => {
    const { projectId, status } = req.query;
    let chapters = await store.listItems('chapters');
    if (projectId) chapters = chapters.filter(c => c.projectId === projectId);
    if (status) chapters = chapters.filter(c => c.status === status);
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    res.json(chapters);
});

router.post('/', createChapter, async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const chapter = {
        id, projectId: req.body.projectId,
        chapterNumber: req.body.chapterNumber || 1,
        title: req.body.title || `Chapter ${req.body.chapterNumber || 1}`,
        outline: req.body.outline || '', content: req.body.content || '',
        status: req.body.status || 'outlined',
        wordCount: req.body.content ? req.body.content.length : 0,
        round: req.body.round || 1,
        writerOutput: req.body.writerOutput || '',
        firstReviewOutput: req.body.firstReviewOutput || '',
        secondReviewOutput: req.body.secondReviewOutput || '',
        finalEditorOutput: req.body.finalEditorOutput || '',
        history: [], createdAt: now, updatedAt: now
    };
    await store.setItem('chapters', id, chapter);
    res.apiOk(chapter, null, 201);
});

router.post('/:id/reset', chapterIdParam, async (req, res) => {
    const chapter = await store.getItem('chapters', req.params.id);
    if (!chapter) return res.apiError(NOT_FOUND.statusCode, 'Chapter not found', NOT_FOUND.code);

    const cascade = await cascadeCleanup(chapter.id, chapter.projectId, chapter.chapterNumber, chapter);

    chapter.status = 'outlined'; chapter._reviewRounds = 0; chapter._wordCountRetry = 0;
    chapter._skipReason = undefined; chapter.round = 0; chapter.wordCount = 0;
    chapter.content = ''; chapter.writerOutput = ''; chapter.firstReviewOutput = '';
    chapter.secondReviewOutput = ''; chapter.finalEditorOutput = '';
    chapter.materialManagerOutput = ''; chapter.history = [];
    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapter.id, chapter);

    // 清除项目级metrics和circuitBreaker — 防止旧失败率触发Alert Loop
    try {
        const { getMetrics } = require('../services/metricsCollector');
        const { getCircuitBreaker } = require('../services/reviewCircuitBreaker');
        const metrics = getMetrics(chapter.projectId);
        await metrics.resetAgentPassRates();
        const cb = getCircuitBreaker(chapter.projectId);
        await cb.reset();
    } catch (e) { logger.warn('chapters', '[CHAPTERS] Failed to reset metrics/circuitBreaker:', e.message); }

    logger.info('chapters', `[CHAPTERS] Reset chapter ${chapter.chapterNumber} (id=${chapter.id}):`, JSON.stringify(cascade));
    res.json({ success: true, resetChapter: chapter.id, cascade });
});

router.get('/:id', chapterIdParam, async (req, res) => {
    const chapter = await store.getItem('chapters', req.params.id);
    if (!chapter) return res.apiError(NOT_FOUND.statusCode, 'Chapter not found', NOT_FOUND.code);
    res.json(chapter);
});

router.put('/:id', updateChapter, async (req, res) => {
    const chapter = await store.getItem('chapters', req.params.id);
    if (!chapter) return res.apiError(NOT_FOUND.statusCode, 'Chapter not found', NOT_FOUND.code);
    const updated = {
        ...chapter, ...req.body, id: chapter.id,
        wordCount: req.body.content ? req.body.content.length : chapter.wordCount,
        updatedAt: new Date().toISOString()
    };
    if (req.body.content && req.body.content !== chapter.content) {
        updated.history = [...(chapter.history || []), { content: chapter.content, timestamp: new Date().toISOString(), round: chapter.round }];
    }
    await store.setItem('chapters', chapter.id, updated);
    if (updated.status === STATUS_VALUES.APPROVED && req.body.content) {
        try { saveFinalContent(updated.projectId, updated); } catch (e) { logger.warn('chapters', '[CHAPTERS] Failed to update final content:', e.message); }
    }
    res.json(updated);
});

router.delete('/:id', chapterIdParam, async (req, res) => {
    const chapter = await store.getItem('chapters', req.params.id);
    if (!chapter) return res.apiError(NOT_FOUND.statusCode, 'Chapter not found', NOT_FOUND.code);

    const cascade = await cascadeCleanup(req.params.id, chapter.projectId, chapter.chapterNumber, chapter);
    await store.deleteItem('chapters', req.params.id);

    logger.info('chapters', `[CHAPTERS] Cascade delete chapter ${chapter.chapterNumber} (id=${req.params.id}):`, JSON.stringify(cascade));
    res.json({ success: true, deletedChapter: req.params.id, cascade });
});

router.get('/download-novel/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const project = await store.getItem('projects', projectId);
    if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

    const chapters = (await store.listItems('chapters'))
        .filter(c => c.projectId === projectId && isCompletedOrApproved(c.status))
        .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

    if (chapters.length === 0) return res.apiError(NOT_FOUND.statusCode, 'No completed chapters to download', NOT_FOUND.code);

    const lines = [`${project.name || 'Untitled'}\n`];
    for (const ch of chapters) {
        const title = ch.title || `第${ch.chapterNumber}章`;
        lines.push(`${'='.repeat(40)}`, `${title}`, `${'='.repeat(40)}\n`);
        const content = ch.polishedContent || ch.content || ch.writerOutput || '';
        lines.push(content || '[内容缺失]', '\n');
    }

    const novelText = lines.join('\n');
    const filename = `${project.name || 'novel'}_全${chapters.length}章.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send('\ufeff' + novelText);
});

module.exports = router;
