/**
 * libraryExtractRoutes — 藏经阁「一键提取」与技法写操作路由
 *
 * 挂载点：/api/library（由 routes/library.js 以 router.use 方式挂载）
 * 端点：
 *   POST   /extract              提交提取任务（异步，返回taskId）
 *   GET    /extract/:taskId      查询提取进度/结果
 *   GET    /extract-dimensions   可选提取维度清单（前端下拉用）
 *   POST   /techniques           手动新增技法
 *   DELETE /technique/:id        删除技法
 *
 * 长任务说明：提取需多次LLM调用，走 routes/pipeline/asyncTaskManager 统一任务表，
 *   前端轮询 GET /extract/:taskId 直到 isTerminal。
 * 文件位置：server/routes/libraryExtractRoutes.js
 */
const express = require('express');
const router = express.Router();
const libraryStore = require('../services/libraryStore');
const techIndex = require('../services/techIndex');
const { runExtraction } = require('../services/techniqueExtraction');
const { CRAFT_DIMENSIONS } = require('../config/libraryExtractDimensions');
const { LIBRARY_EXTRACT } = require('../config/systemConfig');
const { createTask, getTask, updateTask, isTerminal } = require('./pipeline/asyncTaskManager');
const logger = require('../shared/logger');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND } = ERROR_CODES;

router.get('/extract-dimensions', (req, res) => {
    res.json(CRAFT_DIMENSIONS.map(d => ({ id: d.id, label: d.label, hint: d.hint, injection: d.injection })));
});

router.post('/extract', async (req, res) => {
    try {
        const { text, novelName, dimensions } = req.body || {};
        if (!text || text.length < LIBRARY_EXTRACT.MIN_TEXT_CHARS) {
            return res.apiError(VALIDATION_ERROR.statusCode, `文本过短，至少 ${LIBRARY_EXTRACT.MIN_TEXT_CHARS} 字`, VALIDATION_ERROR.code);
        }
        const taskId = createTask('libextract');
        res.json({ success: true, data: { taskId, textChars: text.length, dimensions: (dimensions || CRAFT_DIMENSIONS.map(d => d.id)) } });

        // 异步执行：任务表登记进度，前端轮询
        runExtraction({
            text, novelName, dimensions, taskId,
            onProgress: ({ step, index, total }) => updateTask(taskId, { progress: Math.round((index - 1) / total * 100), step }),
        }).then(result => {
            updateTask(taskId, { status: 'completed', progress: 100, step: '完成', result });
            logger.info('libraryExtract', `提取完成：新增 ${result.inserted} 条技法（库总量 ${result.libraryTotal}）`, { taskId });
        }).catch(err => {
            updateTask(taskId, { status: 'failed', error: err.message });
            logger.error('libraryExtract', `提取失败: ${err.message}`, { taskId });
        });
    } catch (e) {
        return res.apiError(VALIDATION_ERROR.statusCode, e.message, VALIDATION_ERROR.code);
    }
});

router.get('/extract/:taskId', (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.apiError(NOT_FOUND.statusCode, '任务不存在或已过期', NOT_FOUND.code);
    res.json({
        success: true,
        data: {
            taskId: req.params.taskId,
            status: task.status,
            progress: task.progress || 0,
            step: task.step || '',
            terminal: isTerminal(task.status),
            result: task.result || null,
            error: task.error || null,
        },
    });
});

router.post('/techniques', async (req, res) => {
    try {
        const tech = req.body || {};
        if (!tech.id || !tech.display_name) {
            return res.apiError(VALIDATION_ERROR.statusCode, '缺少 id 或 display_name', VALIDATION_ERROR.code);
        }
        const saved = await libraryStore.upsertTechnique(tech);
        await techIndex.reload();
        res.json({ success: true, data: saved });
    } catch (e) {
        return res.apiError(VALIDATION_ERROR.statusCode, e.message, VALIDATION_ERROR.code);
    }
});

module.exports = router;
