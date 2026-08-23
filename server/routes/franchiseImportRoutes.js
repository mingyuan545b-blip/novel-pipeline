const logger = require('../shared/logger');
const express = require('express');
const router = express.Router();
const store = require('../store');
const multer = require('multer');
const { parseFile, importParsedToFranchise, importParsedToProject } = require('../services/fileParser');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/parse-file', upload.array('files', 20), (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.apiError(VALIDATION_ERROR.statusCode, '请上传文件', VALIDATION_ERROR.code);
        }

        const allParsed = [];
        const mergedCategories = {};

        for (const file of files) {
            const fileName = file.originalname;
            const ext = fileName.split('.').pop().toLowerCase();
            if (!['txt', 'md', 'markdown'].includes(ext)) continue;

            const parsed = parseFile(file.buffer, fileName);
            allParsed.push(parsed);

            for (const [type, items] of Object.entries(parsed.categories)) {
                if (!mergedCategories[type]) mergedCategories[type] = [];
                mergedCategories[type].push(...items);
            }
        }

        if (allParsed.length === 0) {
            return res.apiError(VALIDATION_ERROR.statusCode, '没有有效的 TXT 或 Markdown 文件', VALIDATION_ERROR.code);
        }

        const categorySummary = Object.entries(mergedCategories).map(([type, items]) => ({
            key: type,
            label: getTypeLabel(type),
            icon: getTypeIcon(type),
            count: items.length,
            items: items.slice(0, 10).map(item => ({
                name: item.name,
                preview: item.preview || item.content?.substring(0, 60) || ''
            }))
        }));

        const totalSections = allParsed.reduce((sum, p) => sum + p.totalSections, 0);

        res.json({
            data: {
                fileCount: allParsed.length,
                totalSections,
                categories: categorySummary,
                parsedData: allParsed
            }
        });
    } catch (error) {
        logger.error('franchiseImportRoute', '[FRANCHISE] parse-file error:', error);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-parsed', async (req, res) => {
    try {
        const { franchiseId, projectId, parsedData, importCategories } = req.body;
        if (!franchiseId && !projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'franchiseId 或 projectId 必填', VALIDATION_ERROR.code);
        if (!parsedData || parsedData.length === 0) return res.apiError(VALIDATION_ERROR.statusCode, '没有可导入的数据', VALIDATION_ERROR.code);

        const importCounts = {};
        for (const parsed of parsedData) {
            if (projectId) {
                const counts = importParsedToProject(projectId, parsed, importCategories);
                for (const [type, count] of Object.entries(counts)) {
                    importCounts[type] = (importCounts[type] || 0) + count;
                }
            }
            if (franchiseId) {
                const franchise = await store.getItem('franchises', franchiseId);
                if (franchise) {
                    const counts = importParsedToFranchise(franchiseId, parsed, importCategories);
                    for (const [type, count] of Object.entries(counts)) {
                        importCounts[type] = (importCounts[type] || 0) + count;
                    }
                }
            }
        }

        res.json({ success: true, importCounts });
    } catch (error) {
        logger.error('franchiseImportRoute', '[FRANCHISE] import-parsed error:', error);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/import-file-to-project', upload.array('files', 20), async (req, res) => {
    try {
        const projectId = req.body.projectId;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);

        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const files = req.files;
        if (!files || files.length === 0) return res.apiError(VALIDATION_ERROR.statusCode, '请上传文件', VALIDATION_ERROR.code);

        const importCounts = {};
        for (const file of files) {
            const fileName = file.originalname;
            const ext = fileName.split('.').pop().toLowerCase();
            if (!['txt', 'md', 'markdown'].includes(ext)) continue;

            const parsed = parseFile(file.buffer, fileName);
            const counts = importParsedToProject(projectId, parsed, null);
            for (const [type, count] of Object.entries(counts)) {
                importCounts[type] = (importCounts[type] || 0) + count;
            }
        }

        res.json({ success: true, importCounts });
    } catch (error) {
        logger.error('franchiseImportRoute', '[FRANCHISE] import-file-to-project error:', error);
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

function getTypeLabel(type) {
    const labels = {
        'character': '人物设定', 'relationship': '人物关系', 'worldview': '世界观/背景',
        'location': '地点/势力', 'equipment': '装备/道具', 'power-system': '战力体系',
        'plot': '剧情/事件', 'other': '其他元素'
    };
    return labels[type] || type;
}

function getTypeIcon(type) {
    const icons = {
        'character': '👤', 'relationship': '🔗', 'worldview': '🌍',
        'location': '🏰', 'equipment': '⚔', 'power-system': '⚡',
        'plot': '📜', 'other': '📦'
    };
    return icons[type] || '📄';
}

module.exports = router;
