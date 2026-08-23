const logger = require('../shared/logger');
const router = require('express').Router();
const multer = require('multer');
const workshop = require('../services/workshop');
const { validateTemplate, importTemplate, exportProjectAsTemplate } = require('../services/templateImporter');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/validate-template', (req, res) => {
    try {
        const template = req.body;
        const result = validateTemplate(template);
        res.json(result);
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-template', (req, res) => {
    try {
        const { template, overwrite, projectId } = req.body;
        if (!template) return res.apiError(VALIDATION_ERROR.statusCode, 'template is required', VALIDATION_ERROR.code);
        const result = importTemplate(template, { overwrite: !!overwrite, projectId: projectId || null });
        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] import-template error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-template-file', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.apiError(VALIDATION_ERROR.statusCode, 'No file uploaded', VALIDATION_ERROR.code);
        const template = JSON.parse(req.file.buffer.toString('utf-8'));
        const { overwrite, projectId } = req.body;
        const result = importTemplate(template, { overwrite: overwrite === 'true', projectId: projectId || null });
        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] import-template-file error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/export-template/:projectId', (req, res) => {
    try {
        const template = exportProjectAsTemplate(req.params.projectId);
        res.json(template);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] export-template error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-setting', upload.array('files', 10), async (req, res) => {
    try {
        const { projectId, settingText, generateMaterials, generateOutlines, chapterCount } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);

        let combinedText = settingText || '';

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const content = file.buffer.toString('utf-8');
                combinedText += `\n\n=== ${file.originalname} ===\n${content}`;
            }
        }

        if (!combinedText.trim()) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'No setting text or files provided', VALIDATION_ERROR.code);
        }

        const result = await workshop.importSettingAndGenerate(projectId, combinedText, {
            generateMaterials: generateMaterials !== 'false',
            generateOutlines: generateOutlines !== 'false',
            chapterCount: parseInt(chapterCount) || 10
        });

        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] import-setting error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-setting-text', async (req, res) => {
    try {
        const { projectId, settingText, generateMaterials, generateOutlines, chapterCount } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        if (!settingText?.trim()) return res.apiError(VALIDATION_ERROR.statusCode, 'settingText is required', VALIDATION_ERROR.code);

        const result = await workshop.importSettingAndGenerate(projectId, settingText, {
            generateMaterials: generateMaterials !== false,
            generateOutlines: generateOutlines !== false,
            chapterCount: parseInt(chapterCount) || 10
        });

        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] import-setting-text error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/generate-materials', async (req, res) => {
    try {
        const { projectId, settingText } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        if (!settingText?.trim()) return res.apiError(VALIDATION_ERROR.statusCode, 'settingText is required', VALIDATION_ERROR.code);

        const store = require('../store');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const result = await workshop.generateMaterials(projectId, settingText, project);
        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] generate-materials error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/generate-outlines', async (req, res) => {
    try {
        const { projectId, settingText, chapterCount } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        if (!settingText?.trim()) return res.apiError(VALIDATION_ERROR.statusCode, 'settingText is required', VALIDATION_ERROR.code);

        const store = require('../store');
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const result = await workshop.generateOutlines(projectId, settingText, project, parseInt(chapterCount) || 10);
        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] generate-outlines error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/fuse-novels', upload.array('files', 10), async (req, res) => {
    try {
        const { extractTechniques, extractElements, fusionAnalysis } = req.body;
        const novelTexts = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                novelTexts.push(file.buffer.toString('utf-8'));
            }
        }

        if (novelTexts.length < 2) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'At least 2 novel files are required for fusion', VALIDATION_ERROR.code);
        }

        const result = await workshop.fuseNovels(novelTexts, {
            extractTechniques: extractTechniques !== 'false',
            extractElements: extractElements !== 'false',
            fusionAnalysis: fusionAnalysis !== 'false'
        });

        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] fuse-novels error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/fuse-novels-text', async (req, res) => {
    try {
        const { novels, extractTechniques, extractElements, fusionAnalysis } = req.body;
        if (!novels || !Array.isArray(novels) || novels.length < 2) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'At least 2 novel texts are required for fusion', VALIDATION_ERROR.code);
        }

        const result = await workshop.fuseNovels(novels, {
            extractTechniques: extractTechniques !== false,
            extractElements: extractElements !== false,
            fusionAnalysis: fusionAnalysis !== false
        });

        res.json(result);
    } catch (error) {
        logger.error('workshop', '[WORKSHOP] fuse-novels-text error:', error.stack || error.message);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
