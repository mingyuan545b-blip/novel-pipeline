/**
 * knowledgeAccessRoutes.js — 限知认知访问API路由
 * 事件×角色稀疏矩阵，双向查询高效
 */
const express = require('express');
const router = express.Router();
const knowledgeAccess = require('../../services/knowledgeBase/knowledgeAccess');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

// projectId 长度上限（与 validators.js projectIdParam 一致）
const PROJECT_ID_MAX_LENGTH = 100;

/** GET /knowledge-access?projectId=xxx&factId=xxx&entityId=xxx */
router.get('/', async (req, res) => {
    try {
        const { projectId, factId, entityId } = req.query;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        if (typeof projectId !== 'string' || projectId.length > PROJECT_ID_MAX_LENGTH) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId 格式无效', VALIDATION_ERROR.code);
        }

        if (factId) {
            const items = await knowledgeAccess.getAccessByFact(projectId, factId);
            return res.json(items);
        }
        if (entityId) {
            const items = await knowledgeAccess.getAccessByEntity(projectId, entityId);
            return res.json(items);
        }
        const items = await knowledgeAccess.getAccessByProject(projectId);
        res.json(items);
    } catch (err) {
        return res.apiError(INTERNAL_ERROR.statusCode, 'Failed to query knowledge access', INTERNAL_ERROR.code, { message: err.message });
    }
});

/** POST /knowledge-access — 创建或更新限知记录 */
router.post('/', async (req, res) => {
    try {
        const { projectId, factId, entityId, factText, confidence, sourceHow, sinceChapter, notes } = req.body;
        if (!projectId || !factId || !entityId) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, factId, entityId are required', VALIDATION_ERROR.code);
        }
        // 限定 projectId 长度，防止异常长字符串注入
        if (typeof projectId !== 'string' || projectId.length > PROJECT_ID_MAX_LENGTH) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId 格式无效', VALIDATION_ERROR.code);
        }
        const record = await knowledgeAccess.upsertAccess(projectId, factId, entityId, {
            factText, confidence, sourceHow, sinceChapter, notes,
        });
        res.apiOk(record, null, 201);
    } catch (err) {
        return res.apiError(VALIDATION_ERROR.statusCode, 'Failed to create knowledge access', VALIDATION_ERROR.code, { message: err.message });
    }
});

/** POST /knowledge-access/batch — 批量创建 */
router.post('/batch', async (req, res) => {
    try {
        const { projectId, records } = req.body;
        if (!projectId || !Array.isArray(records)) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and records array are required', VALIDATION_ERROR.code);
        }
        const results = await knowledgeAccess.batchUpsertAccess(projectId, records);
        res.json({ success: true, results });
    } catch (err) {
        return res.apiError(VALIDATION_ERROR.statusCode, 'Batch create failed', VALIDATION_ERROR.code, { message: err.message });
    }
});

/** DELETE /knowledge-access/:id — 删除单条 */
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await knowledgeAccess.deleteAccess(req.params.id);
        if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Record not found', NOT_FOUND.code);
        res.json({ success: true });
    } catch (err) {
        return res.apiError(INTERNAL_ERROR.statusCode, 'Failed to delete', INTERNAL_ERROR.code, { message: err.message });
    }
});

module.exports = router;
