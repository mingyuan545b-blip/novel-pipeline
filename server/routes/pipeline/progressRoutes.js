/**
 * progressRoutes — 运行看板 API
 *
 * GET /api/pipeline/progress/:projectId
 *   一次返回：总进度（第几章/共几章）、当前步骤与已进行时长、第几轮、
 *   最近步骤时间线（含近似耗时）、各 Agent 耗时统计、章节状态分布、异常摘要。
 *
 * 为什么合成一个端点：这些数据分散在 projects / chapters / pipeline-logs /
 *   infinite-pipeline-state / metrics 五处，前端分别拉会产生 5 个请求且时序不一致，
 *   容易出现"进度条和日志对不上"。组装逻辑放 services/pipeline/progressView.js（纯函数，可测）。
 *
 * 文件位置：server/routes/pipeline/progressRoutes.js
 */
const router = require('express').Router();
const store = require('../../store');
const logger = require('../../shared/logger');
const { ERROR_CODES } = require('../../shared/errorCodes');
const { buildProgressView } = require('../../services/pipeline/progressView');

const { INTERNAL_ERROR, NOT_FOUND } = ERROR_CODES;

router.get('/progress/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await store.getItem('projects', projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const [chapters, logs, infiniteStatus] = await Promise.all([
            store.queryItems('chapters', { projectId }),
            store.queryItems('pipeline-logs', { projectId }),
            require('../../services/pipeline/infinitePipeline')
                .getInfinitePipelineStatus(projectId)
                .catch(() => ({ running: false })),
        ]);
        // Agent 耗时来自 metrics（真实计时），不是日志推算
        const agentTimings = (project._pipeline_metrics && project._pipeline_metrics.agentTimings) || {};
        res.json(buildProgressView({ project, chapters, logs, infiniteStatus, agentTimings }));
    } catch (e) {
        logger.warn('progressRoutes', 'build view failed: ' + e.message);
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
