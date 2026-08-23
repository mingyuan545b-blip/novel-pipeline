const router = require('express').Router();
const logger = require('../../shared/logger');
const { getTask } = require('./asyncTaskManager');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/task/:taskId', (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.apiError(NOT_FOUND.statusCode, 'Task not found', NOT_FOUND.code);
    res.json(task);
});

router.get('/pipeline-logs/:projectId/:chapterId', async (req, res) => {
    try {
        const { projectId, chapterId } = req.params;
        const store = require('../../store');
        const logId = `${chapterId}_pipeline`;
        const logData = await store.getItem('pipeline-logs', logId);
        if (!logData) return res.json({ entries: [], chapterId, projectId });
        res.json(logData);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/pipeline-logs/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const store = require('../../store');
        const allLogs = await store.queryItems('pipeline-logs', { projectId });
        res.json(allLogs);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
