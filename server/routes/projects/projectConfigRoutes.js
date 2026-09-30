/**
 * projectConfigRoutes - 项目配置路由（targets/testConnection）
 *
 * 从crudRoutes.js拆出，避免registerCrudRoutes函数超过100行限制
 * 包含：目标章节数/字数更新、Agent连接测试
 */
const store = require('../../store');
const { TARGET_CHAPTERS_FIELD } = require('../../config/targetChaptersSchema');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

function registerProjectConfigRoutes(router) {
    // 修复API断裂：前端projectsApi.saveTargets调用PUT /:id/targets，后端之前无此路由
    // Schema-First：使用TARGET_CHAPTERS_FIELD标准字段名，处理targetChapters=0的falsy陷阱
    router.put('/:id/targets', async (req, res) => {
        const project = await store.getItem('projects', req.params.id);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);
        const { targetChapters, targetWordCount } = req.body || {};
        const updates = { updatedAt: new Date().toISOString() };
        // targetChapters=0是合法值（表示不限章节数），不能用|| falsy判断
        if (typeof targetChapters === 'number' && targetChapters >= 0) {
            updates[TARGET_CHAPTERS_FIELD] = targetChapters;
        } else if (targetChapters !== undefined && targetChapters !== null) {
            const num = Number(targetChapters);
            if (Number.isFinite(num) && num >= 0) updates[TARGET_CHAPTERS_FIELD] = num;
        }
        if (typeof targetWordCount === 'number' && targetWordCount >= 0) {
            updates.targetWordCount = targetWordCount;
        } else if (targetWordCount !== undefined && targetWordCount !== null) {
            const num = Number(targetWordCount);
            if (Number.isFinite(num) && num >= 0) updates.targetWordCount = num;
        }
        const updated = { ...project, ...updates };
        await store.setItem('projects', project.id, updated);
        // 改目标章数会直接影响章节门槛/停机条件，必须让运行中的 Agent 立刻看到
        require('../../services/dataContext').resetDataContext(project.id);
        res.json({ success: true, targetChapters: updated[TARGET_CHAPTERS_FIELD], targetWordCount: updated.targetWordCount });
    });

    // 修复API断裂：前端projectsApi.testConnection调用POST /test-connection，后端之前无此路由
    // 复用llm.testConnection逻辑（与settings/test一致），测试agent model config连接
    router.post('/test-connection', async (req, res) => {
        try {
            const llm = require('../../services/llm');
            const result = await llm.testConnection(req.body);
            res.json(result);
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    });
}

module.exports = { registerProjectConfigRoutes };
