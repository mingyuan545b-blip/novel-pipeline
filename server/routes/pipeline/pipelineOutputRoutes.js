/**
 * pipelineOutputRoutes - Pipeline输出路径查询路由
 *
 * 修复API断裂：前端pipelineApi.getOutputPaths调用GET /pipeline/output-paths/:projectId/:chapterId
 * 后端之前无此路由，导致404
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { OUTPUT_DIR } = require('../../services/fileOutput');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.get('/output-paths/:projectId/:chapterId', async (req, res) => {
    try {
        const { projectId, chapterId } = req.params;
        const projectDir = path.join(OUTPUT_DIR, projectId);
        const chaptersDir = path.join(projectDir, 'chapters');
        const finalDir = path.join(projectDir, 'final');

        const paths = {
            projectId,
            chapterId,
            chapters: [],
            final: null,
        };

        // 扫描chapters目录，查找与chapterId相关的输出文件
        if (fs.existsSync(chaptersDir)) {
            const files = fs.readdirSync(chaptersDir);
            paths.chapters = files.filter(f => f.includes(chapterId)).map(f => ({
                fileName: f,
                path: `/output/${projectId}/chapters/${f}`,
            }));
        }

        // 扫描final目录
        if (fs.existsSync(finalDir)) {
            const files = fs.readdirSync(finalDir);
            const finalFile = files.find(f => f.includes(chapterId));
            if (finalFile) {
                paths.final = {
                    fileName: finalFile,
                    path: `/output/${projectId}/final/${finalFile}`,
                };
            }
        }

        res.json({ success: true, paths });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
