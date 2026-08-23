const router = require('express').Router();
const mapService = require('../services/mapService');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

router.get('/levels', (req, res) => {
    res.json(mapService.getMapLevels());
});

router.get('/root', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(mapService.getRootNode(projectId));
});

router.get('/tree', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(mapService.getTree(projectId));
});

router.get('/node/:id', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const node = mapService.getNode(projectId, req.params.id);
    if (!node) return res.apiError(NOT_FOUND.statusCode, 'Node not found', NOT_FOUND.code);
    res.json(node);
});

router.get('/children/:parentId', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(mapService.getChildren(projectId, req.params.parentId));
});

router.post('/node', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const node = mapService.createNode(projectId, req.body);
    res.json(node);
});

router.put('/node/:id', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const updated = mapService.updateNode(projectId, req.params.id, req.body);
    if (!updated) return res.apiError(NOT_FOUND.statusCode, 'Node not found', NOT_FOUND.code);
    res.json(updated);
});

router.delete('/node/:id', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const result = mapService.deleteNode(projectId, req.params.id);
    if (!result) return res.apiError(VALIDATION_ERROR.statusCode, 'Cannot delete root node', VALIDATION_ERROR.code);
    res.json(result);
});

router.post('/batch', (req, res) => {
    const { projectId, parentId, nodes } = req.body;
    if (!projectId || !parentId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and parentId are required', VALIDATION_ERROR.code);
    const created = mapService.batchCreateNodes(projectId, parentId, nodes || []);
    res.json({ created, count: created.length });
});

router.get('/faction/:factionId', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    res.json(mapService.getFactionTerritories(projectId, req.params.factionId));
});

router.post('/import-materials', (req, res) => {
    const { projectId, parentId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const result = mapService.importFromMaterials(projectId, parentId || null);
    res.json(result);
});

module.exports = router;
