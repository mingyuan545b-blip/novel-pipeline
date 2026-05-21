const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const publish = require('../services/publish');
const multiPublisher = require('../services/multiPlatformPublisher');
const store = require('../store');

router.get('/platforms', (req, res) => {
    res.json(publish.getPlatforms());
});

router.get('/platforms/:id', (req, res) => {
    const p = publish.getPlatform(req.params.id);
    if (!p) return res.status(404).json({ error: 'Platform not found' });
    res.json(p);
});

router.get('/accounts', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(publish.getPlatformAccounts(projectId));
});

router.post('/accounts', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const account = publish.addPlatformAccount(projectId, req.body);
    res.json(account);
});

router.put('/accounts/:id', (req, res) => {
    const updated = publish.updatePlatformAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Account not found' });
    res.json(updated);
});

router.delete('/accounts/:id', (req, res) => {
    publish.deletePlatformAccount(req.params.id);
    res.json({ success: true });
});

router.post('/accounts/:id/verify', async (req, res) => {
    try {
        const result = await publish.verifyPlatformAccount(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ valid: false, message: error.message });
    }
});

router.get('/queue', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(publish.getPublishQueue(projectId));
});

router.post('/queue', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const item = publish.addToPublishQueue(projectId, req.body);
    res.json(item);
});

router.post('/queue/batch', (req, res) => {
    const { projectId, chapters, platformAccountId, platformName, scheduleInterval } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const created = publish.batchAddToQueue(projectId, chapters || [], platformAccountId, platformName, scheduleInterval);
    res.json({ created, count: created.length });
});

router.put('/queue/:id', (req, res) => {
    const updated = publish.updatePublishQueueItem(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Queue item not found' });
    res.json(updated);
});

router.delete('/queue/:id', (req, res) => {
    publish.deletePublishQueueItem(req.params.id);
    res.json({ success: true });
});

router.post('/format', (req, res) => {
    const { content, platformId, chapterNumber, chapterTitle } = req.body;
    if (!content || !platformId) return res.status(400).json({ error: 'content and platformId are required' });
    res.json(publish.formatContentForPlatform(content, platformId, chapterNumber, chapterTitle));
});

router.get('/stats/publish', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(publish.getPublishStats(projectId));
});

router.get('/interactions', (req, res) => {
    const { projectId, type, isRead, needsReply } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const filter = {};
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (needsReply) filter.needsReply = needsReply === 'true';
    res.json(publish.getInteractions(projectId, filter));
});

router.post('/interactions', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const interaction = publish.addInteraction(projectId, req.body);
    res.json(interaction);
});

router.post('/interactions/batch', (req, res) => {
    const { projectId, interactions } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const created = (interactions || []).map(i => publish.addInteraction(projectId, i));
    res.json({ created, count: created.length });
});

router.put('/interactions/:id', (req, res) => {
    const updated = publish.updateInteraction(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Interaction not found' });
    res.json(updated);
});

router.delete('/interactions/:id', (req, res) => {
    publish.deleteInteraction(req.params.id);
    res.json({ success: true });
});

router.get('/stats/interactions', (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    res.json(publish.getInteractionStats(projectId));
});

router.post('/fanqie/check-login', async (req, res) => {
    try {
        const { cdpUrl } = req.body;
        const result = await multiPublisher.checkPlatformLogin('fanqie', cdpUrl || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ loggedIn: false, reason: error.message });
    }
});

router.post('/fanqie/open-writer', async (req, res) => {
    try {
        const { cdpUrl } = req.body;
        const result = await multiPublisher.openWriterBackend('fanqie', cdpUrl || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/fanqie/open-editor', async (req, res) => {
    try {
        const { cdpUrl, bookId } = req.body;
        const result = await multiPublisher.openFanqieBookEditor('fanqie', cdpUrl || '', bookId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/multi-check-login', async (req, res) => {
    const { platform, cdpUrl } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    try {
        const result = await multiPublisher.checkPlatformLogin(platform, cdpUrl || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ loggedIn: false, reason: error.message });
    }
});

router.post('/multi-open-writer', async (req, res) => {
    const { platform, cdpUrl } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    try {
        const result = await multiPublisher.openWriterBackend(platform, cdpUrl || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/multi-open-editor', async (req, res) => {
    const { platform, cdpUrl, bookId } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    try {
        if (platform === 'fanqie') {
            const result = await multiPublisher.openFanqieBookEditor(platform, cdpUrl || '', bookId);
            res.json(result);
        } else {
            const result = await multiPublisher.openWriterBackend(platform, cdpUrl || '');
            res.json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/fanqie/publish', async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const state = multiPublisher.getPlatformState('fanqie');
    if (state.running) {
        return res.status(409).json({ error: '已有发布任务在运行中' });
    }
    multiPublisher.publishToPlatform('fanqie', projectId, req.body).catch(err => {
        console.error(`[PUBLISH] Async publish failed for fanqie: ${err.message}`);
    });
    res.json({ started: true, platform: 'fanqie' });
});

router.post('/fanqie/stop', (req, res) => {
    const result = multiPublisher.stopPublish('fanqie');
    res.json(result);
});

router.get('/fanqie/status', (req, res) => {
    res.json(multiPublisher.getPlatformState('fanqie'));
});

router.post('/fanqie/close-browser', async (req, res) => {
    await multiPublisher.closeBrowser('fanqie');
    res.json({ success: true });
});

router.get('/multi-platforms', (req, res) => {
    const platforms = {};
    for (const [key, cfg] of Object.entries(multiPublisher.PLATFORMS)) {
        platforms[key] = { name: cfg.name, writerUrl: cfg.writerUrl };
    }
    res.json(platforms);
});

router.post('/multi-publish', async (req, res) => {
    const { projectId, platform } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    const state = multiPublisher.getPlatformState(platform);
    if (state.running) return res.status(409).json({ error: `${multiPublisher.PLATFORMS[platform]?.name || platform}已有发布任务在运行中` });
    multiPublisher.publishToPlatform(platform, projectId, req.body).catch(err => {
        console.error(`[PUBLISH] Async publish failed for ${platform}: ${err.message}`);
    });
    res.json({ started: true, platform });
});

router.post('/multi-stop', (req, res) => {
    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    const result = multiPublisher.stopPublish(platform);
    res.json(result);
});

router.get('/multi-status/:platform', (req, res) => {
    res.json(multiPublisher.getPlatformState(req.params.platform));
});

router.get('/multi-status', (req, res) => {
    res.json(multiPublisher.getAllStates());
});

router.post('/multi-close-browser', async (req, res) => {
    const { platform } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    await multiPublisher.closeBrowser(platform);
    res.json({ success: true });
});

router.post('/multi-update', async (req, res) => {
    const { projectId, platform, chapterNumbers, cdpUrl, bookId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!platform) return res.status(400).json({ error: 'platform is required' });
    if (!chapterNumbers || !Array.isArray(chapterNumbers) || chapterNumbers.length === 0) {
        return res.status(400).json({ error: 'chapterNumbers is required (array of chapter numbers)' });
    }
    const state = multiPublisher.getPlatformState(platform);
    if (state.running) return res.status(409).json({ error: `${multiPublisher.PLATFORMS[platform]?.name || platform}已有任务在运行中` });

    if (platform === 'qimao') {
        multiPublisher.updateChaptersToQimao(platform, projectId, { cdpUrl: cdpUrl || '', bookId: bookId || '', chapterNumbers }).catch(err => {
            console.error(`[PUBLISH] Async update failed for ${platform}: ${err.message}`);
        });
    } else {
        return res.status(400).json({ error: `暂不支持${platform}平台的修改功能` });
    }
    res.json({ started: true, platform, mode: 'update', chapterCount: chapterNumbers.length });
});

module.exports = router;
