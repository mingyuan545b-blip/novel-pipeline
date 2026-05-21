const router = require('express').Router();
const multer = require('multer');
const workshop = require('../services/workshop');
const { validateTemplate, importTemplate, exportProjectAsTemplate } = require('../services/templateImporter');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/validate-template', (req, res) => {
    try {
        const template = req.body;
        const result = validateTemplate(template);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-template', (req, res) => {
    try {
        const { template, overwrite, projectId } = req.body;
        if (!template) return res.status(400).json({ error: 'template is required' });
        const result = importTemplate(template, { overwrite: !!overwrite, projectId: projectId || null });
        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] import-template error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-template-file', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const template = JSON.parse(req.file.buffer.toString('utf-8'));
        const { overwrite, projectId } = req.body;
        const result = importTemplate(template, { overwrite: overwrite === 'true', projectId: projectId || null });
        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] import-template-file error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/export-template/:projectId', (req, res) => {
    try {
        const template = exportProjectAsTemplate(req.params.projectId);
        res.json(template);
    } catch (error) {
        console.error('[WORKSHOP] export-template error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-setting', upload.array('files', 10), async (req, res) => {
    try {
        const { projectId, settingText, generateMaterials, generateOutlines, chapterCount } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        let combinedText = settingText || '';

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const content = file.buffer.toString('utf-8');
                combinedText += `\n\n=== ${file.originalname} ===\n${content}`;
            }
        }

        if (!combinedText.trim()) {
            return res.status(400).json({ error: 'No setting text or files provided' });
        }

        const result = await workshop.importSettingAndGenerate(projectId, combinedText, {
            generateMaterials: generateMaterials !== 'false',
            generateOutlines: generateOutlines !== 'false',
            chapterCount: parseInt(chapterCount) || 10
        });

        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] import-setting error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-setting-text', async (req, res) => {
    try {
        const { projectId, settingText, generateMaterials, generateOutlines, chapterCount } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!settingText?.trim()) return res.status(400).json({ error: 'settingText is required' });

        const result = await workshop.importSettingAndGenerate(projectId, settingText, {
            generateMaterials: generateMaterials !== false,
            generateOutlines: generateOutlines !== false,
            chapterCount: parseInt(chapterCount) || 10
        });

        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] import-setting-text error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-materials', async (req, res) => {
    try {
        const { projectId, settingText } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!settingText?.trim()) return res.status(400).json({ error: 'settingText is required' });

        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const result = await workshop.generateMaterials(projectId, settingText, project);
        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] generate-materials error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-outlines', async (req, res) => {
    try {
        const { projectId, settingText, chapterCount } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!settingText?.trim()) return res.status(400).json({ error: 'settingText is required' });

        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const result = await workshop.generateOutlines(projectId, settingText, project, parseInt(chapterCount) || 10);
        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] generate-outlines error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
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
            return res.status(400).json({ error: 'At least 2 novel files are required for fusion' });
        }

        const result = await workshop.fuseNovels(novelTexts, {
            extractTechniques: extractTechniques !== 'false',
            extractElements: extractElements !== 'false',
            fusionAnalysis: fusionAnalysis !== 'false'
        });

        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] fuse-novels error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/fuse-novels-text', async (req, res) => {
    try {
        const { novels, extractTechniques, extractElements, fusionAnalysis } = req.body;
        if (!novels || !Array.isArray(novels) || novels.length < 2) {
            return res.status(400).json({ error: 'At least 2 novel texts are required for fusion' });
        }

        const result = await workshop.fuseNovels(novels, {
            extractTechniques: extractTechniques !== false,
            extractElements: extractElements !== false,
            fusionAnalysis: fusionAnalysis !== false
        });

        res.json(result);
    } catch (error) {
        console.error('[WORKSHOP] fuse-novels-text error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
