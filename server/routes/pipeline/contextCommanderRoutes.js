/**
 * contextCommanderRoutes.js — 上下文决策引擎API路由
 * 提供决策预览、用户覆盖管理接口
 */
const router = require('express').Router();
const logger = require('../../shared/logger');
const { resolveContext } = require('../../services/pipeline/contextCommander');
const contextOverrideStore = require('../../services/pipeline/contextOverrideStore');
const { buildContextMap } = require('../../services/pipeline/contextMapBuilder');
const store = require('../../store');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

/** 预览Agent的上下文决策（不执行加载） */
router.post('/context-preview/:projectId', async (req, res) => {
    try {
        const { agentType, chapterNumber, outline } = req.body;
        if (!agentType) return res.apiError(VALIDATION_ERROR.statusCode, 'agentType required', VALIDATION_ERROR.code);

        const project = await store.getItem('projects', req.params.projectId);
        const materials = await store.queryItems('materials', { projectId: req.params.projectId });
        const chapter = { chapterNumber: chapterNumber || 1, outline: outline || '' };

        const context = await resolveContext(agentType, {
            projectId: req.params.projectId, chapter, materials, project,
        });
        res.json(context);
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 获取项目的所有覆盖规则 */
router.get('/context-overrides/:projectId', async (req, res) => {
    try {
        const overrides = await contextOverrideStore.getOverrides(req.params.projectId);
        res.json(overrides);
    } catch (e) {
        logger.warn('contextCommanderRoutes', 'getOverrides failed, returning empty:', e.message);
        res.json([]);
    }
});

/** 设置覆盖规则 */
router.post('/context-overrides/:projectId', async (req, res) => {
    try {
        const { materialId, scope, chapterNumber, volumeNumber, targetDepth, enabled } = req.body;
        if (!materialId || !scope || !targetDepth) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'materialId, scope, targetDepth required', VALIDATION_ERROR.code);
        }
        const result = await contextOverrideStore.setOverride(req.params.projectId, materialId, {
            scope, chapterNumber, volumeNumber, targetDepth, enabled,
        });
        res.json(result);
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 删除覆盖规则 */
router.delete('/context-overrides/:overrideId', async (req, res) => {
    try {
        await contextOverrideStore.deleteOverride(req.params.overrideId);
        res.json({ success: true });
    } catch (e) {
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

/** 获取上下文地图（思维导图数据） */
router.get('/context-map/:projectId', async (req, res) => {
    try {
        const chapterNumber = parseInt(req.query.chapterNumber) || 1;
        const mapData = await buildContextMap(req.params.projectId, chapterNumber);
        res.json(mapData);
    } catch (e) {
        logger.warn('contextCommanderRoutes', 'buildContextMap failed:', e.message);
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
