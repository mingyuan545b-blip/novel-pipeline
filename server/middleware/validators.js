const { body, param, query, validationResult } = require('express-validator');
const { ERROR_CODES } = require('../shared/errorCodes');
const { ALL_STATUSES } = require('../services/chapterStatus');

const { VALIDATION_ERROR } = ERROR_CODES;

// 通用 limit 参数约束（G3：统一上限，避免各路由重复定义）
const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 200;

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.apiError(VALIDATION_ERROR.statusCode, '输入验证失败', VALIDATION_ERROR.code, { details: errors.array() });
    }
    next();
}

/**
 * 统一解析 list 端点的 limit 查询参数（G3：消除 _parseLimit/clampLimit/parseInt 重复实现）
 * @param {*} raw - req.query.limit 原始值
 * @param {number} [defaultLimit=50] - 默认值
 * @param {number} [maxLimit=200] - 上限
 * @returns {number} 解析后的 limit
 */
function parseLimit(raw, defaultLimit = LIST_LIMIT_DEFAULT, maxLimit = LIST_LIMIT_MAX) {
    // 空值/空字符串走默认值
    if (raw === undefined || raw === null || raw === '') return defaultLimit;
    // 严格数字解析：Number('1abc')=NaN，拒绝后缀字符串，与 express-validator isInt 行为一致
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(Math.floor(parsed), maxLimit);
}

const projectIdParam = [
    param('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId格式无效'),
    handleValidation
];

const chapterIdParam = [
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('id格式无效'),
    handleValidation
];

const materialIdParam = [
    param('materialId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('materialId格式无效'),
    handleValidation
];

/**
 * 通用列表查询参数验证（G3：limit/offset 通用校验）
 */
const listQueryParams = [
    query('limit').optional().isInt({ min: 1, max: LIST_LIMIT_MAX }).withMessage(`limit 必须为 1-${LIST_LIMIT_MAX}`),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset 必须为非负整数'),
    handleValidation
];

const createProject = [
    body('name').isString().trim().isLength({ min: 1, max: 200 }).withMessage('项目名长度1-200'),
    body('genre').isString().trim().isLength({ min: 1, max: 100 }).withMessage('题材(genre)必填，Pipeline全部依赖genre加载配置'),
    body('description').optional().isString().isLength({ max: 10000 }).withMessage('描述过长'),
    body('subGenre').optional().isString().trim().isLength({ max: 100 }),
    body('season').optional().isInt({ min: 1, max: 100 }),
    body('parentProjectId').optional().isString().trim().isLength({ max: 100 }),
    body('genreProfile').optional().isString().trim().isLength({ max: 100 }),
    handleValidation
];

const updateProject = [
    param('id').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 10000 }),
    body('styleProfile').optional().isObject(),
    body('subGenre').optional().isString().trim().isLength({ max: 100 }),
    body('season').optional().isInt({ min: 1, max: 100 }),
    body('parentProjectId').optional().isString().trim().isLength({ max: 100 }),
    body('genreProfile').optional().isString().trim().isLength({ max: 100 }),
    handleValidation
];

const createChapter = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterNumber').isInt({ min: 1, max: 99999 }).withMessage('章节号必须是1-99999的整数'),
    body('title').optional().isString().trim().isLength({ max: 500 }),
    handleValidation
];

const updateChapter = [
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('章节id必填'),
    body('content').optional().isString().isLength({ max: 500000 }).withMessage('章节内容过长'),
    body('status').optional().isString().isIn(ALL_STATUSES).withMessage('无效的章节状态'),
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
    param('id').isString().trim().isLength({ min: 1, max: 100 }).withMessage('素材id必填'),
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

const pipelineStep = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('chapterId必填'),
    body('step').isString().trim().isLength({ min: 1, max: 50 }).withMessage('step必填'),
    body('round').optional().isInt({ min: 1, max: 20 }),
    handleValidation
];

const generateMaterials = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterId').optional().isString().trim().isLength({ min: 1, max: 100 }),
    handleValidation
];

const generateOutlines = [
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('volumeNumber').optional().isInt({ min: 1, max: 100 }),
    handleValidation
];

const resetChapterContent = [
    body('chapterId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('chapterId必填'),
    body('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    handleValidation
];

const toggleMaterialLock = [
    body('materialId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('materialId必填'),
    body('locked').isBoolean().withMessage('locked必填'),
    handleValidation
];

const clearChaptersAfter = [
    param('projectId').isString().trim().isLength({ min: 1, max: 100 }).withMessage('projectId必填'),
    body('chapterNumber').isInt({ min: 1, max: 99999 }).withMessage('chapterNumber必填'),
    handleValidation
];

module.exports = {
    handleValidation,
    parseLimit,
    projectIdParam,
    chapterIdParam,
    materialIdParam,
    listQueryParams,
    createProject,
    updateProject,
    createChapter,
    updateChapter,
    createMaterial,
    updateMaterial,
    startPipeline,
    startInfinitePipeline,
    pipelineStep,
    generateMaterials,
    generateOutlines,
    resetChapterContent,
    toggleMaterialLock,
    clearChaptersAfter,
    LIST_LIMIT_DEFAULT,
    LIST_LIMIT_MAX
};
