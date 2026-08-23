const router = require('express').Router();
const comic = require('../../services/comic');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/config', async (req, res) => {
    try { res.json(await comic.getConfig()); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/config', async (req, res) => {
    try { res.json(await comic.saveConfig(req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/test-connection', async (req, res) => {
    try { res.json(await comic.testConnection(req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/workflows', async (req, res) => {
    try { res.json(await comic.getWorkflows(req.query.projectId)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/workflows/:id', async (req, res) => {
    try {
        const workflow = await comic.getWorkflow(req.params.id);
        if (!workflow) return res.apiError(NOT_FOUND.statusCode, 'Workflow not found', NOT_FOUND.code);
        res.json(workflow);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/workflows', async (req, res) => {
    try { res.json(await comic.createWorkflow(req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/workflows/upload', require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('file'), async (req, res) => {
    try {
        const { name, type, description, projectId } = req.body;
        let jsonContent = '';
        if (req.file) jsonContent = req.file.buffer.toString('utf-8');
        res.json(await comic.createWorkflow({
            name: name || req.file?.originalname || 'Unnamed',
            type: type || 'custom', description: description || '',
            projectId: projectId || 'default', jsonContent
        }));
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.put('/workflows/:id', async (req, res) => {
    try { res.json(await comic.updateWorkflow(req.params.id, req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.delete('/workflows/:id', async (req, res) => {
    try { await comic.deleteWorkflow(req.params.id); res.json({ success: true }); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/storyboards', async (req, res) => {
    try { res.json(await comic.getStoryboards(req.query.projectId)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/storyboards', async (req, res) => {
    try { res.json(await comic.createStoryboard(req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.put('/storyboards/:id', async (req, res) => {
    try { res.json(await comic.updateStoryboard(req.params.id, req.body)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.delete('/storyboards/:id', async (req, res) => {
    try { await comic.deleteStoryboard(req.params.id); res.json({ success: true }); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/storyboards/:id/render', async (req, res) => {
    try { res.json(await comic.renderStoryboard(req.params.id)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/storyboards/batch-render', async (req, res) => {
    try { res.json(await comic.batchRender(req.body.ids || [])); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/render-queue', async (req, res) => {
    try { res.json(await comic.getRenderQueue(req.query.projectId)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/render-queue/:id/cancel', async (req, res) => {
    try { await comic.cancelRender(req.params.id); res.json({ success: true }); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/render-queue/:id/retry', async (req, res) => {
    try { res.json(await comic.retryRender(req.params.id)); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/render-queue/clear', async (req, res) => {
    try { await comic.clearCompleted(req.body.projectId); res.json({ success: true }); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/start-comfyui', async (req, res) => {
    try { res.json(await comic.startLocalComfyUI()); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/stop-comfyui', async (req, res) => {
    try { res.json(await comic.stopLocalComfyUI()); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/comfyui-status', (req, res) => {
    res.json(comic.getComfyUIStatus());
});

module.exports = router;
