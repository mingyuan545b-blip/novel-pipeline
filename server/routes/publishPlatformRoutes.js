const express = require('express');
const router = express.Router();
const logger = require('../shared/logger');
const multiPublisher = require('../services/multiPlatformPublisher');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, CONFLICT, INTERNAL_ERROR } = ERROR_CODES;

router.post('/fanqie/check-login', async (req, res) => {
    try {
        const { cdpUrl } = req.body;
        const result = await multiPublisher.checkPlatformLogin('fanqie', cdpUrl || '');
        res.json(result);
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code, { loggedIn: false }); }
});

router.post('/fanqie/open-writer', async (req, res) => {
    try {
        const { cdpUrl } = req.body;
        const result = await multiPublisher.openWriterBackend('fanqie', cdpUrl || '');
        res.json(result);
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/fanqie/open-editor', async (req, res) => {
    try {
        const { cdpUrl, bookId } = req.body;
        const result = await multiPublisher.openFanqieBookEditor('fanqie', cdpUrl || '', bookId);
        res.json(result);
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/fanqie/publish', async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    const state = multiPublisher.getPlatformState('fanqie');
    if (state.running) return res.apiError(CONFLICT.statusCode, '已有发布任务在运行中', CONFLICT.code);
    multiPublisher.publishToPlatform('fanqie', projectId, req.body).catch(err => {
        logger.error('publish', `[PUBLISH] Async publish failed for fanqie: ${err.message}`);
    });
    res.json({ started: true, platform: 'fanqie' });
});

router.post('/fanqie/stop', (req, res) => { res.json(multiPublisher.stopPublish('fanqie')); });

router.get('/fanqie/status', (req, res) => { res.json(multiPublisher.getPlatformState('fanqie')); });

router.post('/fanqie/close-browser', async (req, res) => { await multiPublisher.closeBrowser('fanqie'); res.json({ success: true }); });

router.get('/multi-platforms', (req, res) => {
    const platforms = {};
    for (const [key, cfg] of Object.entries(multiPublisher.PLATFORMS)) { platforms[key] = { name: cfg.name, writerUrl: cfg.writerUrl }; }
    res.json(platforms);
});

router.post('/multi-check-login', async (req, res) => {
    const { platform, cdpUrl } = req.body;
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    try { res.json(await multiPublisher.checkPlatformLogin(platform, cdpUrl || '')); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/multi-open-writer', async (req, res) => {
    const { platform, cdpUrl } = req.body;
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    try { res.json(await multiPublisher.openWriterBackend(platform, cdpUrl || '')); }
    catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/multi-open-editor', async (req, res) => {
    const { platform, cdpUrl, bookId } = req.body;
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    try {
        if (platform === 'fanqie') { res.json(await multiPublisher.openFanqieBookEditor(platform, cdpUrl || '', bookId)); }
        else { res.json(await multiPublisher.openWriterBackend(platform, cdpUrl || '')); }
    } catch (error) { return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/multi-publish', async (req, res) => {
    const { projectId, platform } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    const state = multiPublisher.getPlatformState(platform);
    if (state.running) return res.apiError(CONFLICT.statusCode, `${multiPublisher.PLATFORMS[platform]?.name || platform}已有发布任务在运行中`, CONFLICT.code);
    multiPublisher.publishToPlatform(platform, projectId, req.body).catch(err => {
        logger.error('publish', `[PUBLISH] Async publish failed for ${platform}: ${err.message}`);
    });
    res.json({ started: true, platform });
});

router.post('/multi-stop', (req, res) => {
    const { platform } = req.body;
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    res.json(multiPublisher.stopPublish(platform));
});

router.get('/multi-status/:platform', (req, res) => { res.json(multiPublisher.getPlatformState(req.params.platform)); });
router.get('/multi-status', (req, res) => { res.json(multiPublisher.getAllStates()); });

router.post('/multi-close-browser', async (req, res) => {
    const { platform } = req.body;
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    await multiPublisher.closeBrowser(platform);
    res.json({ success: true });
});

router.post('/multi-update', async (req, res) => {
    const { projectId, platform, chapterNumbers, cdpUrl, bookId } = req.body;
    if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
    if (!platform) return res.apiError(VALIDATION_ERROR.statusCode, 'platform is required', VALIDATION_ERROR.code);
    if (!chapterNumbers || !Array.isArray(chapterNumbers) || chapterNumbers.length === 0) return res.apiError(VALIDATION_ERROR.statusCode, 'chapterNumbers is required', VALIDATION_ERROR.code);
    const state = multiPublisher.getPlatformState(platform);
    if (state.running) return res.apiError(CONFLICT.statusCode, `${multiPublisher.PLATFORMS[platform]?.name || platform}已有任务在运行中`, CONFLICT.code);
    if (platform === 'qimao') {
        multiPublisher.updateChaptersToQimao(platform, projectId, { cdpUrl: cdpUrl || '', bookId: bookId || '', chapterNumbers }).catch(err => {
            logger.error('publish', `[PUBLISH] Async update failed for ${platform}: ${err.message}`);
        });
    } else { return res.apiError(VALIDATION_ERROR.statusCode, `暂不支持${platform}平台的修改功能`, VALIDATION_ERROR.code); }
    res.json({ started: true, platform, mode: 'update', chapterCount: chapterNumbers.length });
});

module.exports = router;
