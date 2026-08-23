const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const comfyuiWorkflow = require('../../services/comfyuiWorkflow');
const upload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR, SERVICE_UNAVAILABLE } = ERROR_CODES;

router.post('/comfyui/text-to-image', async (req, res) => {
    try {
        const { prompt, width, height, steps, seed, savePath, cfg, maxShift, baseShift, sampler } = req.body;
        if (!prompt) return res.apiError(VALIDATION_ERROR.statusCode, 'prompt is required', VALIDATION_ERROR.code);
        const result = await comfyuiWorkflow.generateTextToImage(prompt, {
            width: width || 768, height: height || 512, steps: steps || 20,
            seed, savePath, cfg: cfg || 3.0, maxShift: maxShift || 2.05,
            baseShift: baseShift || 0.95, sampler: sampler || 'euler'
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/image-to-video', async (req, res) => {
    try {
        const { prompt, imagePath, width, height, length, steps, seed, strength, savePath, cfg, maxShift, baseShift, sampler } = req.body;
        if (!prompt || !imagePath) return res.apiError(VALIDATION_ERROR.statusCode, 'prompt and imagePath are required', VALIDATION_ERROR.code);
        const result = await comfyuiWorkflow.generateImageToVideo(prompt, imagePath, {
            width: width || 768, height: height || 512, length: length || 25,
            steps: steps || 20, seed, strength: strength || 1.0, savePath,
            cfg: cfg || 3.0, maxShift: maxShift || 2.05, baseShift: baseShift || 0.95, sampler: sampler || 'euler'
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.apiError(VALIDATION_ERROR.statusCode, 'No image file provided', VALIDATION_ERROR.code);
        const tmpPath = path.join(__dirname, '..', '..', '..', 'output', 'tmp_upload_' + req.file.originalname);
        fs.writeFileSync(tmpPath, req.file.buffer);
        const result = await comfyuiWorkflow.uploadImage(tmpPath, req.file.originalname);
        fs.unlinkSync(tmpPath);
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/wan22-text-to-video', async (req, res) => {
    try {
        const { prompt, width, height, length, steps, seed, savePath, cfg, sampler, scheduler, loraName } = req.body;
        if (!prompt) return res.apiError(VALIDATION_ERROR.statusCode, 'prompt is required', VALIDATION_ERROR.code);
        const result = await comfyuiWorkflow.generateWan22TextToVideo(prompt, {
            width: width || 832, height: height || 480, length: length || 41,
            steps: steps || 20, seed, savePath, cfg: cfg || 5.0,
            sampler: sampler || 'uni_pc_bh2', scheduler: scheduler || 'normal', loraName: loraName || ''
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/wan22-image-to-video', async (req, res) => {
    try {
        const { prompt, imagePath, width, height, length, steps, seed, savePath, cfg, sampler, scheduler } = req.body;
        if (!prompt || !imagePath) return res.apiError(VALIDATION_ERROR.statusCode, 'prompt and imagePath are required', VALIDATION_ERROR.code);
        const result = await comfyuiWorkflow.generateWan22ImageToVideo(prompt, imagePath, {
            width: width || 832, height: height || 480, length: length || 41,
            steps: steps || 20, seed, savePath, cfg: cfg || 5.0,
            sampler: sampler || 'uni_pc_bh2', scheduler: scheduler || 'normal'
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/comfyui/system-info', async (req, res) => {
    try {
        const info = await comfyuiWorkflow.getSystemInfo();
        if (!info) return res.apiError(SERVICE_UNAVAILABLE.statusCode, 'ComfyUI not running', SERVICE_UNAVAILABLE.code);
        res.json(info);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/ltx23-realistic-video', async (req, res) => {
    try {
        const { prompt, width, height, length, steps, seed, savePath, cfg, sampler, maxShift, baseShift, imagePath, strength } = req.body;
        if (!prompt) return res.apiError(VALIDATION_ERROR.statusCode, 'prompt is required', VALIDATION_ERROR.code);
        const result = await comfyuiWorkflow.generateLTX23RealisticVideo(prompt, {
            width: width || 1280, height: height || 720, length: length || 25,
            steps: steps || 35, seed, savePath, cfg: cfg || 4.5,
            sampler: sampler || 'euler_ancestral', maxShift: maxShift || 2.5,
            baseShift: baseShift || 1.0, imagePath: imagePath || null, strength: strength || 1.0
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.post('/comfyui/free-memory', async (req, res) => {
    try {
        const { unloadModels, freeMemory: freeMem } = req.body;
        const result = await comfyuiWorkflow.freeMemory({
            unloadModels: unloadModels !== false, freeMemory: freeMem !== false
        });
        res.json(result);
    } catch (error) { res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code); }
});

router.get('/comfyui/auto-free-config', (req, res) => {
    res.json(comfyuiWorkflow.getAutoFreeConfig());
});

router.post('/comfyui/auto-free-config', (req, res) => {
    const config = comfyuiWorkflow.setAutoFreeConfig(req.body);
    res.json(config);
});

module.exports = router;
