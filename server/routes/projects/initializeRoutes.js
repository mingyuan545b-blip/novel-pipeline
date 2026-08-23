/**
 * initializeRoutes — 项目一键初始化API
 * 创建项目 + 素材生成 + 大纲生成 + 主线任务/时间线自动初始化，一步到位
 */
const logger = require('../../shared/logger');
const store = require('../../store');
const { createProjectData } = require('./projectCreateHandler');
const { verifyProject } = require('./projectCreateVerify');
const pipeline = require('../../services/pipeline');
const auditLog = require('../../services/auditLog');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

async function handleInitialize(req, res) {
    const startTime = Date.now();
    const steps = [];

    try {
        // Step 1: 创建项目
        const project = createProjectData(req);
        await store.setItem('projects', project.id, project);
        const verification = await verifyProject(project.id);
        steps.push({ step: 'create', status: 'ok', projectId: project.id, verification });

        if (!verification.valid) {
            return res.apiOk({
                projectId: project.id,
                message: '项目创建成功但验证失败',
                steps, verification,
                allStepsSucceeded: false
            }, null, 201);
        }

        // Step 2: 生成素材
        let materialResult = null;
        try {
            materialResult = await pipeline.generateInitialMaterials(project.id, req.body.materialPrompt || '');
            steps.push({ step: 'materials', status: 'ok', count: materialResult.materials?.length || 0 });
        } catch (matErr) {
            logger.error('initialize', '素材生成失败:', { errorMessage: matErr.message });
            steps.push({ step: 'materials', status: 'failed', error: matErr.message });
        }

        // Step 3: 生成大纲
        let outlineResult = null;
        try {
            outlineResult = await pipeline.generateChapterOutlines(
                project.id,
                req.body.outlinePrompt || '',
                req.body.targetChapters ?? null
            );
            steps.push({ step: 'outlines', status: 'ok', count: outlineResult.chapters?.length || 0 });
        } catch (outErr) {
            logger.error('initialize', '大纲生成失败:', { errorMessage: outErr.message });
            steps.push({ step: 'outlines', status: 'failed', error: outErr.message });
        }

        // Step 4: 自动初始化主线任务/支线任务/时间线
        // 修复陷阱#58：autoInitProject此前是僵尸功能（定义了但未被调用），导致新项目主线任务空数据
        try {
            const { autoInitProject } = require('../questAutoInit');
            const questResult = await autoInitProject(project.id);
            steps.push({
                step: 'quests',
                status: 'ok',
                questsCreated: questResult.created?.quests || 0,
                timelinesCreated: questResult.created?.timelines || 0,
                mainQuest: questResult.summary?.mainQuest || ''
            });
        } catch (questErr) {
            logger.error('initialize', '主线任务初始化失败:', { errorMessage: questErr.message });
            steps.push({ step: 'quests', status: 'failed', error: questErr.message });
        }

        const elapsed = Date.now() - startTime;
        auditLog.log(auditLog.ACTIONS.PROJECT_CREATE, {
            projectId: project.id,
            summary: `Initialized project "${project.name}" in ${elapsed}ms`,
            metadata: { genre: project.genre, steps: steps.map(s => `${s.step}:${s.status}`).join(',') }
        });

        const hasFailure = steps.some(s => s.status === 'failed');
        res.apiOk({
            projectId: project.id,
            projectName: project.name,
            elapsed,
            steps,
            verification,
            allStepsSucceeded: !hasFailure
        }, null, 201);
    } catch (err) {
        logger.error('initialize', '项目初始化异常:', { errorMessage: err.message, errorStack: err.stack });
        res.apiError(
            INTERNAL_ERROR.statusCode,
            err.message,
            INTERNAL_ERROR.code,
            { steps, elapsed: Date.now() - startTime }
        );
    }
}

function registerInitializeRoutes(router) {
    router.post('/initialize', handleInitialize);
}

module.exports = { registerInitializeRoutes };
