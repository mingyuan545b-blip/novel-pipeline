const express = require('express');
const router = express.Router();
const stateSnapshot = require('../../services/stateSnapshot');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.post('/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber } = req.body || {};
        const snapshot = await stateSnapshot.createSnapshot(projectId, chapterNumber);
        res.json({ success: true, snapshot });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const snapshots = await stateSnapshot.getSnapshotHistory(projectId);
        res.json({ snapshots });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/latest', async (req, res) => {
    try {
        const { projectId } = req.params;
        const snapshot = await stateSnapshot.getSnapshot(projectId);
        res.json({ snapshot });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/character/:characterId/timeline', async (req, res) => {
    try {
        const { projectId, characterId } = req.params;
        const timeline = await stateSnapshot.getCharacterTimeline(projectId, characterId);
        res.json({ timeline });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/relationship/:relationshipId/timeline', async (req, res) => {
    try {
        const { projectId, relationshipId } = req.params;
        const timeline = await stateSnapshot.getRelationshipTimeline(projectId, relationshipId);
        res.json({ timeline });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/power/:characterId', async (req, res) => {
    try {
        const { projectId, characterId } = req.params;
        const powerHistory = await stateSnapshot.getPowerHistory(projectId, characterId);
        res.json({ powerHistory });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/foreshadowing', async (req, res) => {
    try {
        const { projectId } = req.params;
        const foreshadowing = await stateSnapshot.getForeshadowingTracker(projectId);
        res.json({ foreshadowing });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/snapshots/:projectId/restore/:chapterNumber', async (req, res) => {
    try {
        const { projectId, chapterNumber } = req.params;
        const result = await stateSnapshot.restoreSnapshot(projectId, parseInt(chapterNumber));
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/snapshots/:projectId/diff', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { from, to } = req.query;
        const diff = await stateSnapshot.diffSnapshots(projectId, parseInt(from), parseInt(to));
        res.json({ diff });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
