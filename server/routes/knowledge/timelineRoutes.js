const express = require('express');
const router = express.Router();
const { timelineService } = require('../../services/timelineService');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/timeline/:projectId/events', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber, eventType } = req.query;
        const events = await timelineService.getEvents(projectId, {
            chapterNumber: chapterNumber ? parseInt(chapterNumber) : undefined,
            eventType
        });
        res.json({ events });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/timeline/:projectId/events', async (req, res) => {
    try {
        const { projectId } = req.params;
        const event = req.body;
        const result = await timelineService.addEvent(projectId, event);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.put('/timeline/:projectId/events/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const updates = req.body;
        const result = await timelineService.updateEvent(eventId, updates);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.delete('/timeline/:projectId/events/:eventId', async (req, res) => {
    try {
        const { projectId, eventId } = req.params;
        const result = await timelineService.deleteEvent(projectId, eventId);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/timeline/:projectId/causal-chain/:eventId', async (req, res) => {
    try {
        const { projectId, eventId } = req.params;
        const chain = await timelineService.getCausalChain(projectId, eventId);
        res.json({ chain });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/timeline/:projectId/conflicts', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber } = req.query;
        const conflicts = await timelineService.detectTimeConflicts(projectId, chapterNumber ? parseInt(chapterNumber) : 0);
        res.json({ conflicts });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/timeline/:projectId/stats', async (req, res) => {
    try {
        const { projectId } = req.params;
        const stats = await timelineService.getStats(projectId);
        res.json({ stats });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
