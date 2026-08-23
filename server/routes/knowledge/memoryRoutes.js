const express = require('express');
const router = express.Router();
const memory = require('../../services/memory');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/memory/:projectId/layers', async (req, res) => {
    try {
        const { projectId } = req.params;
        const layers = await memory.getMemoryLayers(projectId);
        res.json({ layers });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/memory/:projectId/layer/:layer', async (req, res) => {
    try {
        const { projectId, layer } = req.params;
        const data = await memory.getMemoryLayerData(projectId, layer);
        res.json({ layer, data });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/memory/:projectId/build/:layer', async (req, res) => {
    try {
        const { projectId, layer } = req.params;
        const { force = false } = req.body || {};
        const result = await memory.buildMemoryLayer(projectId, layer, { force });
        res.json({ success: true, layer, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/memory/:projectId/assemble', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { layers } = req.body || {};
        const result = await memory.assembleMemoryContext(projectId, layers);
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.get('/memory/:projectId/formatted-context', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterNumber } = req.query;
        const context = await memory.getFormattedContext(projectId, chapterNumber ? parseInt(chapterNumber) : undefined);
        res.json({ context });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

router.post('/memory/:projectId/volume-summary/:volumeNum', async (req, res) => {
    try {
        const { projectId, volumeNum } = req.params;
        const result = await memory.generateVolumeSummary(projectId, parseInt(volumeNum));
        res.json({ success: true, result });
    } catch (e) { return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code); }
});

module.exports = router;
