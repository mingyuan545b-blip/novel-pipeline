const express = require('express');
const router = express.Router();
const publish = require('../services/publish');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

router.get('/queue', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(publish.getPublishQueue(projectId));
});

router.post('/queue', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(publish.addToPublishQueue(projectId, req.body));
});

router.post('/queue/batch', (req, res) => {
    const { projectId, chapters, platformAccountId, platformName, scheduleInterval } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const created = publish.batchAddToQueue(projectId, chapters || [], platformAccountId, platformName, scheduleInterval);
    res.json({ created, count: created.length });
});

router.put('/queue/:id', (req, res) => {
    const updated = publish.updatePublishQueueItem(req.params.id, req.body);
    if (!updated) return res.apiError(NOT_FOUND.statusCode, 'Queue item not found', NOT_FOUND.code);
    res.json(updated);
});

router.delete('/queue/:id', (req, res) => {
    publish.deletePublishQueueItem(req.params.id);
    res.json({ success: true });
});

router.post('/format', (req, res) => {
    const { content, platformId, chapterNumber, chapterTitle } = req.body;
    if (!content || !platformId) return res.apiError(VALIDATION_ERROR.statusCode, 'content and platformId are required', VALIDATION_ERROR.code);
    res.json(publish.formatContentForPlatform(content, platformId, chapterNumber, chapterTitle));
});

router.get('/stats/publish', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(publish.getPublishStats(projectId));
});

router.get('/interactions', (req, res) => {
    const { projectId, type, isRead, needsReply } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const filter = {};
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (needsReply) filter.needsReply = needsReply === 'true';
    res.json(publish.getInteractions(projectId, filter));
});

router.post('/interactions', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(publish.addInteraction(projectId, req.body));
});

router.post('/interactions/batch', (req, res) => {
    const { projectId, interactions } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const created = (interactions || []).map(i => publish.addInteraction(projectId, i));
    res.json({ created, count: created.length });
});

router.put('/interactions/:id', (req, res) => {
    const updated = publish.updateInteraction(req.params.id, req.body);
    if (!updated) return res.apiError(NOT_FOUND.statusCode, 'Interaction not found', NOT_FOUND.code);
    res.json(updated);
});

router.delete('/interactions/:id', (req, res) => {
    publish.deleteInteraction(req.params.id);
    res.json({ success: true });
});

router.get('/stats/interactions', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(publish.getInteractionStats(projectId));
});

module.exports = router;
