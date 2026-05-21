const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const comic = require('../services/comic');
const tts = require('../services/tts');
const exportService = require('../services/export');
const comfyuiWorkflow = require('../services/comfyuiWorkflow');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/config', async (req, res) => {
    try {
        const config = await comic.getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/config', async (req, res) => {
    try {
        const config = await comic.saveConfig(req.body);
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/test-connection', async (req, res) => {
    try {
        const result = await comic.testConnection(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/workflows', async (req, res) => {
    try {
        const workflows = await comic.getWorkflows(req.query.projectId);
        res.json(workflows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/workflows/:id', async (req, res) => {
    try {
        const workflow = await comic.getWorkflow(req.params.id);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        res.json(workflow);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/workflows', async (req, res) => {
    try {
        const workflow = await comic.createWorkflow(req.body);
        res.json(workflow);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/workflows/upload', upload.single('file'), async (req, res) => {
    try {
        const { name, type, description, projectId } = req.body;
        let jsonContent = '';
        if (req.file) {
            jsonContent = req.file.buffer.toString('utf-8');
        }
        const workflow = await comic.createWorkflow({
            name: name || req.file?.originalname || 'Unnamed',
            type: type || 'custom',
            description: description || '',
            projectId: projectId || 'default',
            jsonContent
        });
        res.json(workflow);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/workflows/:id', async (req, res) => {
    try {
        const workflow = await comic.updateWorkflow(req.params.id, req.body);
        res.json(workflow);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/workflows/:id', async (req, res) => {
    try {
        await comic.deleteWorkflow(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/storyboards', async (req, res) => {
    try {
        const storyboards = await comic.getStoryboards(req.query.projectId);
        res.json(storyboards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/storyboards', async (req, res) => {
    try {
        const storyboard = await comic.createStoryboard(req.body);
        res.json(storyboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/storyboards/:id', async (req, res) => {
    try {
        const storyboard = await comic.updateStoryboard(req.params.id, req.body);
        res.json(storyboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/storyboards/:id', async (req, res) => {
    try {
        await comic.deleteStoryboard(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/storyboards/:id/render', async (req, res) => {
    try {
        const result = await comic.renderStoryboard(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/storyboards/batch-render', async (req, res) => {
    try {
        const results = await comic.batchRender(req.body.ids || []);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/render-queue', async (req, res) => {
    try {
        const queue = await comic.getRenderQueue(req.query.projectId);
        res.json(queue);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/render-queue/:id/cancel', async (req, res) => {
    try {
        await comic.cancelRender(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/render-queue/:id/retry', async (req, res) => {
    try {
        const result = await comic.retryRender(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/render-queue/clear', async (req, res) => {
    try {
        await comic.clearCompleted(req.body.projectId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/start-comfyui', async (req, res) => {
    try {
        const result = await comic.startLocalComfyUI();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/stop-comfyui', async (req, res) => {
    try {
        const result = await comic.stopLocalComfyUI();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/comfyui-status', (req, res) => {
    res.json(comic.getComfyUIStatus());
});

router.get('/tts/voices', (req, res) => {
    res.json(tts.getVoices());
});

router.post('/tts/synthesize', async (req, res) => {
    try {
        const { text, voice, rate, volume, pitch, projectId, fileName } = req.body;
        if (!text) return res.status(400).json({ error: 'text is required' });
        const outputDir = projectId
            ? path.join(__dirname, '..', '..', 'output', projectId, 'tts')
            : path.join(__dirname, '..', '..', 'output', 'tts');
        const outputPath = path.join(outputDir, fileName || `tts_${Date.now()}.mp3`);
        const result = await tts.synthesize(text, { voice, rate, volume, pitch, outputPath });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/tts/synthesize-batch', async (req, res) => {
    try {
        const { dialogues, projectId, episodeNumber } = req.body;
        if (!dialogues || !Array.isArray(dialogues)) {
            return res.status(400).json({ error: 'dialogues array is required' });
        }
        const outputDir = projectId
            ? path.join(__dirname, '..', '..', 'output', projectId, 'tts', `ep${String(episodeNumber || 1).padStart(2, '0')}`)
            : path.join(__dirname, '..', '..', 'output', 'tts');
        const result = await tts.synthesizeChapterDialogue(dialogues, outputDir, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/export-episode', async (req, res) => {
    try {
        const { projectId, episode, scenes, title, defaultVoice, burnSubtitles } = req.body;
        if (!projectId || !scenes || !Array.isArray(scenes)) {
            return res.status(400).json({ error: 'projectId and scenes array are required' });
        }
        const result = await exportService.exportComicEpisode(projectId, {
            episode,
            title,
            scenes
        }, { defaultVoice, burnSubtitles });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/export-status/:projectId', (req, res) => {
    const episodesDir = path.join(__dirname, '..', '..', 'output', req.params.projectId, 'episodes');
    if (!fs.existsSync(episodesDir)) return res.json({ episodes: [] });
    const episodes = fs.readdirSync(episodesDir).filter(d => {
        const full = path.join(episodesDir, d);
        return fs.statSync(full).isDirectory();
    }).map(d => {
        const full = path.join(episodesDir, d);
        const files = fs.readdirSync(full);
        const mp4Files = files.filter(f => f.endsWith('.mp4') && !f.includes('_audio') && !f.includes('scene_'));
        return {
            name: d,
            videos: mp4Files,
            totalFiles: files.length
        };
    });
    res.json({ episodes });
});

router.post('/comfyui/text-to-image', async (req, res) => {
    try {
        const { prompt, width, height, steps, seed, savePath, cfg, maxShift, baseShift, sampler } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        const result = await comfyuiWorkflow.generateTextToImage(prompt, {
            width: width || 768,
            height: height || 512,
            steps: steps || 20,
            seed,
            savePath,
            cfg: cfg || 3.0,
            maxShift: maxShift || 2.05,
            baseShift: baseShift || 0.95,
            sampler: sampler || 'euler'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/image-to-video', async (req, res) => {
    try {
        const { prompt, imagePath, width, height, length, steps, seed, strength, savePath, cfg, maxShift, baseShift, sampler } = req.body;
        if (!prompt || !imagePath) return res.status(400).json({ error: 'prompt and imagePath are required' });
        const result = await comfyuiWorkflow.generateImageToVideo(prompt, imagePath, {
            width: width || 768,
            height: height || 512,
            length: length || 25,
            steps: steps || 20,
            seed,
            strength: strength || 1.0,
            savePath,
            cfg: cfg || 3.0,
            maxShift: maxShift || 2.05,
            baseShift: baseShift || 0.95,
            sampler: sampler || 'euler'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image file provided' });
        const tmpPath = path.join(__dirname, '..', '..', 'output', 'tmp_upload_' + req.file.originalname);
        fs.writeFileSync(tmpPath, req.file.buffer);
        const result = await comfyuiWorkflow.uploadImage(tmpPath, req.file.originalname);
        fs.unlinkSync(tmpPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/wan22-text-to-video', async (req, res) => {
    try {
        const { prompt, width, height, length, steps, seed, savePath, cfg, sampler, scheduler, loraName } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        const result = await comfyuiWorkflow.generateWan22TextToVideo(prompt, {
            width: width || 832,
            height: height || 480,
            length: length || 41,
            steps: steps || 20,
            seed,
            savePath,
            cfg: cfg || 5.0,
            sampler: sampler || 'uni_pc_bh2',
            scheduler: scheduler || 'normal',
            loraName: loraName || ''
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/wan22-image-to-video', async (req, res) => {
    try {
        const { prompt, imagePath, width, height, length, steps, seed, savePath, cfg, sampler, scheduler } = req.body;
        if (!prompt || !imagePath) return res.status(400).json({ error: 'prompt and imagePath are required' });
        const result = await comfyuiWorkflow.generateWan22ImageToVideo(prompt, imagePath, {
            width: width || 832,
            height: height || 480,
            length: length || 41,
            steps: steps || 20,
            seed,
            savePath,
            cfg: cfg || 5.0,
            sampler: sampler || 'uni_pc_bh2',
            scheduler: scheduler || 'normal'
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/comfyui/system-info', async (req, res) => {
    try {
        const info = await comfyuiWorkflow.getSystemInfo();
        if (!info) return res.status(503).json({ error: 'ComfyUI not running' });
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/ltx23-realistic-video', async (req, res) => {
    try {
        const { prompt, width, height, length, steps, seed, savePath, cfg, sampler, maxShift, baseShift, imagePath, strength } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        const result = await comfyuiWorkflow.generateLTX23RealisticVideo(prompt, {
            width: width || 1280,
            height: height || 720,
            length: length || 25,
            steps: steps || 35,
            seed,
            savePath,
            cfg: cfg || 4.5,
            sampler: sampler || 'euler_ancestral',
            maxShift: maxShift || 2.5,
            baseShift: baseShift || 1.0,
            imagePath: imagePath || null,
            strength: strength || 1.0
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/comfyui/free-memory', async (req, res) => {
    try {
        const { unloadModels, freeMemory: freeMem } = req.body;
        const result = await comfyuiWorkflow.freeMemory({
            unloadModels: unloadModels !== false,
            freeMemory: freeMem !== false
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/comfyui/auto-free-config', (req, res) => {
    res.json(comfyuiWorkflow.getAutoFreeConfig());
});

router.post('/comfyui/auto-free-config', (req, res) => {
    const config = comfyuiWorkflow.setAutoFreeConfig(req.body);
    res.json(config);
});

module.exports = router;
