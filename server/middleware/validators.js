const { body, param, query, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: '输入验证失败', details: errors.array() });
    }
    next();
}

const projectIdParam = [
    param('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId格式无效'),
    handleValidation
];

const chapterIdParam = [
    param('chapterId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('chapterId格式无效'),
    handleValidation
];

const materialIdParam = [
    param('materialId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('materialId格式无效'),
    handleValidation
];

const createProject = [
    body('name').isString().trim().isLength({ min: 1, max: 200 }).withMessage('项目名长度1-200'),
    body('description').optional().isString().isLength({ max: 10000 }).withMessage('描述过长'),
    handleValidation
];

const updateProject = [
    param('projectId').isString().trim().isLength({ min: 1, max: 100 }),
    body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 10000 }),
    body('styleProfile').optional().isObject(),
    handleValidation
];

const createChapter = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterNumber').isInt({ min: 1, max: 99999 }).withMessage('章节号必须是1-99999的整数'),
    body('title').optional().isString().trim().isLength({ max: 500 }),
    handleValidation
];

const updateChapter = [
    param('chapterId').isString().trim().isLength({ min: 1, max: 100 }),
    body('content').optional().isString().isLength({ max: 500000 }).withMessage('章节内容过长'),
    body('status').optional().isString().isIn([
        'outlined', 'written', 'first-reviewing', 'second-reviewing',
        'final-editing', 'approved', 'material-updated',
        'failed-skipped', 'timeout-skipped', 'permanently-skipped'
    ]).withMessage('无效的章节状态'),
    body('chapterNumber').optional().isInt({ min: 1, max: 99999 }),
    handleValidation
];

const createMaterial = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('type').isString().trim().isLength({ min: 1, max: 50 }).withMessage('素材类型必填'),
    body('name').isString().trim().isLength({ min: 1, max: 500 }).withMessage('素材名长度1-500'),
    body('currentContent').optional().isString().isLength({ max: 200000 }).withMessage('素材内容过长'),
    body('parentPlane').optional().isString().trim().isLength({ max: 200 }),
    body('parentFaction').optional().isString().trim().isLength({ max: 200 }),
    handleValidation
];

const updateMaterial = [
    param('materialId').isString().trim().isLength({ min: 1, max: 100 }),
    body('name').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('currentContent').optional().isString().isLength({ max: 200000 }).withMessage('素材内容过长'),
    body('type').optional().isString().trim().isLength({ min: 1, max: 50 }),
    body('parentPlane').optional().isString().trim().isLength({ max: 200 }),
    body('parentFaction').optional().isString().trim().isLength({ max: 200 }),
    body('dialectRegion').optional().isString().trim().isLength({ max: 50 }),
    body('dialectIntensity').optional().isString().isIn(['light', 'medium', 'heavy']),
    body('speechStyle').optional().isString().trim().isLength({ max: 50 }),
    body('speechStyleIntensity').optional().isString().isIn(['light', 'medium', 'heavy']),
    handleValidation
];

const startPipeline = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterId').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('maxRounds').optional().isInt({ min: 1, max: 20 }),
    handleValidation
];

const startInfinitePipeline = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('maxChapters').optional().isInt({ min: 1, max: 1000 }),
    handleValidation
];

module.exports = {
    handleValidation,
    projectIdParam,
    chapterIdParam,
    materialIdParam,
    createProject,
    updateProject,
    createChapter,
    updateChapter,
    createMaterial,
    updateMaterial,
    startPipeline,
    startInfinitePipeline
};
