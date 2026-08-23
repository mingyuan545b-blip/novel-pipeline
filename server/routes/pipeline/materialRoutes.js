const router = require('express').Router();
const logger = require('../../shared/logger');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.post('/toggle-material-lock', async (req, res) => {
    try {
        const store = require('../../store');
        const { materialId, isLocked } = req.body;
        if (!materialId) return res.apiError(VALIDATION_ERROR.statusCode, 'materialId必填', VALIDATION_ERROR.code);

        const mat = await store.getItem('materials', materialId);
        if (!mat) return res.apiError(NOT_FOUND.statusCode, '素材不存在', NOT_FOUND.code);

        mat.isLocked = isLocked;
        mat.updatedAt = new Date().toISOString();
        if (!mat.changeLog) mat.changeLog = [];
        mat.changeLog.push({ action: 'lock-toggle', reason: `手动${isLocked ? '锁定' : '解锁'}`, at: new Date().toISOString() });
        await store.setItem('materials', materialId, mat);

        res.json({ success: true, materialId, isLocked: mat.isLocked });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/set-volume-subplane', async (req, res) => {
    try {
        const store = require('../../store');
        const { projectId, volumeNumber, subplaneId } = req.body;
        if (!projectId || !volumeNumber || !subplaneId) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId, volumeNumber, subplaneId必填', VALIDATION_ERROR.code);
        }

        const subplaneMats = await store.queryItems('materials', { projectId, type: 'sub-plane' });
        for (const m of subplaneMats) {
            const shouldBeUnlocked = m.id === subplaneId;
            if (m.isLocked === shouldBeUnlocked) {
                m.isLocked = !shouldBeUnlocked;
                m.updatedAt = new Date().toISOString();
                await store.setItem('materials', m.id, m);
            }
        }

        const subChildren = (await store.queryItems('materials', { projectId })).filter(m =>
            !m.archived && (m.type === 'character' || m.type === 'faction' || m.type === 'equipment') &&
            m.parentPlane && m.parentPlane !== '主世界' && m.parentPlane !== ''
        );
        for (const c of subChildren) {
            const belongsToUnlocked = c.parentPlane === subplaneId;
            if (c.isLocked === belongsToUnlocked) {
                c.isLocked = !belongsToUnlocked;
                c.updatedAt = new Date().toISOString();
                await store.setItem('materials', c.id, c);
            }
        }

        res.json({ success: true, volumeNumber, unlockedSubplaneId: subplaneId });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

// 修复API断裂：前端pipelineApi.rerunMaterialManager调用POST /rerun-material-manager/:projectId
// 后端之前只有POST /rerun-material-manager（无projectId参数），导致404
// 修复方案：添加:projectId参数到URL，同时保持向后兼容（body传projectId也支持）
router.post('/rerun-material-manager/:projectId', async (req, res) => {
    try {
        const { projectId: projectIdParam } = req.params;
        const { projectId: projectIdBody, chapterId, chapterNumber } = req.body || {};
        const projectId = projectIdParam || projectIdBody;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        const pipeline = require('../../services/pipeline');
        const result = await pipeline.runMaterialManagerStep(projectId, chapterId, chapterNumber);
        res.json(result);
    } catch (error) {
        logger.error('[PIPELINE ROUTE] /rerun-material-manager error:', error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

// 向后兼容：保留无projectId参数的路由（旧调用方可能从body传projectId）
router.post('/rerun-material-manager', async (req, res) => {
    try {
        const { projectId, chapterId, chapterNumber } = req.body;
        if (!projectId) return res.apiError(VALIDATION_ERROR.statusCode, 'projectId is required', VALIDATION_ERROR.code);
        const pipeline = require('../../services/pipeline');
        const result = await pipeline.runMaterialManagerStep(projectId, chapterId, chapterNumber);
        res.json(result);
    } catch (error) {
        logger.error('[PIPELINE ROUTE] /rerun-material-manager error:', error.message);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
