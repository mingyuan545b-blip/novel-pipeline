const router = require('express').Router();
const mapService = require('../services/mapService');

router.get('/levels', (req, res) => {
    res.json(mapService.getMapLevels());
});

router.get('/root', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(mapService.getRootNode(projectId));
});

router.get('/tree', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(mapService.getTree(projectId));
});

router.get('/node/:id', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const node = mapService.getNode(projectId, req.params.id);
    if (!node) return res.status(404).json({ error: 'Node not found' });
    res.json(node);
});

router.get('/children/:parentId', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(mapService.getChildren(projectId, req.params.parentId));
});

router.post('/node', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const node = mapService.createNode(projectId, req.body);
    res.json(node);
});

router.put('/node/:id', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const updated = mapService.updateNode(projectId, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Node not found' });
    res.json(updated);
});

router.delete('/node/:id', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const result = mapService.deleteNode(projectId, req.params.id);
    if (!result) return res.status(400).json({ error: 'Cannot delete root node' });
    res.json(result);
});

router.post('/batch', (req, res) => {
    const { projectId, parentId, nodes } = req.body;
    if (!projectId || !parentId) return res.status(400).json({ error: 'projectId and parentId are required' });
    const created = mapService.batchCreateNodes(projectId, parentId, nodes || []);
    res.json({ created, count: created.length });
});

router.get('/faction/:factionId', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(mapService.getFactionTerritories(projectId, req.params.factionId));
});

router.post('/import-materials', (req, res) => {
    const { projectId, parentId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const result = mapService.importFromMaterials(projectId, parentId || null);
    res.json(result);
});

module.exports = router;
