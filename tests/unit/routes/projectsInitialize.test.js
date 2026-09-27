'use strict';

/**
 * projects initializeRoutes 路由测试（S5.2）
 *
 * 文件位置：tests/unit/routes/projectsInitialize.test.js
 */

jest.mock('../../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const mockStore = new Map();
jest.mock('../../../server/store', () => ({
    setItem: jest.fn(async (type, id, value) => {
        mockStore.set(`${type}:${id}`, { ...value });
    })
}));

jest.mock('../../../server/routes/projects/projectCreateHandler', () => ({
    createProjectData: jest.fn((req) => ({ id: 'new-pid', name: req.body.name, genre: req.body.genre, mode: 'long', createdAt: new Date().toISOString() }))
}));

jest.mock('../../../server/routes/projects/projectCreateVerify', () => ({
    verifyProject: jest.fn(async () => ({ valid: true, errors: [] }))
}));

jest.mock('../../../server/services/pipeline', () => ({
    generateInitialMaterials: jest.fn(),
    generateChapterOutlines: jest.fn()
}));

jest.mock('../../../server/services/auditLog', () => ({
    log: jest.fn(),
    ACTIONS: { PROJECT_CREATE: 'project_create' }
}));

// 修复陷阱#58：mock autoInitProject（initializeRoutes Step 4调用）
jest.mock('../../../server/routes/questAutoInit', () => ({
    autoInitProject: jest.fn()
}));

jest.mock('express', () => {
    const routes = { get: [], post: [], put: [], delete: [] };
    const router = {
        get: (p, ...mw) => routes.get.push({ path: p, mw }),
        post: (p, ...mw) => routes.post.push({ path: p, mw }),
        put: (p, ...mw) => routes.put.push({ path: p, mw }),
        delete: (p, ...mw) => routes.delete.push({ path: p, mw }),
        use: jest.fn(),
        _routes: routes
    };
    return { Router: () => router };
});

const express = require('express');
const { registerInitializeRoutes } = require('../../../server/routes/projects/initializeRoutes');
const { executeRoute } = require('./helpers/routeTestHelper');
const pipeline = require('../../../server/services/pipeline');
const { verifyProject } = require('../../../server/routes/projects/projectCreateVerify');
const auditLog = require('../../../server/services/auditLog');
const { autoInitProject } = require('../../../server/routes/questAutoInit');

function getRoutes() { return express.Router()._routes; }
registerInitializeRoutes(express.Router());

describe('projects initializeRoutes (S5.2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.clear();
        verifyProject.mockResolvedValue({ valid: true, errors: [] });
        pipeline.generateInitialMaterials.mockResolvedValue({ materials: [{ id: 'm1' }] });
        pipeline.generateChapterOutlines.mockResolvedValue({ chapters: [{ id: 'c1' }] });
        autoInitProject.mockResolvedValue({ created: { quests: 2, timelines: 10 }, summary: { mainQuest: '主角的成长之路' } });
    });

    describe('POST /initialize', () => {
        test('全流程成功（创建+素材+大纲+主线任务）', async () => {
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', {
                body: { name: '新项目', genre: 'fantasy', materialPrompt: '素材提示', outlinePrompt: '大纲提示', targetChapters: 10 }
            });
            expect(res._statusCode).toBe(201);
            expect(res._body.success).toBe(true);
            expect(res._body.data.projectId).toBe('new-pid');
            expect(res._body.data.allStepsSucceeded).toBe(true);
            expect(res._body.data.steps).toHaveLength(4);
            expect(res._body.data.steps[0].step).toBe('create');
            expect(res._body.data.steps[1].step).toBe('materials');
            expect(res._body.data.steps[2].step).toBe('outlines');
            expect(res._body.data.steps[3].step).toBe('quests');
            expect(pipeline.generateInitialMaterials).toHaveBeenCalledWith('new-pid', '素材提示');
            expect(pipeline.generateChapterOutlines).toHaveBeenCalledWith('new-pid', '大纲提示', 10);
            expect(autoInitProject).toHaveBeenCalledWith('new-pid');
            expect(auditLog.log).toHaveBeenCalled();
        });

        test('验证失败时返回 201 但 allStepsSucceeded=false', async () => {
            verifyProject.mockResolvedValue({ valid: false, errors: ['配置缺失'] });
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._statusCode).toBe(201);
            expect(res._body.data.allStepsSucceeded).toBe(false);
            expect(res._body.data.message).toContain('验证失败');
            // 验证失败时不执行后续步骤
            expect(pipeline.generateInitialMaterials).not.toHaveBeenCalled();
        });

        test('素材生成失败但大纲继续', async () => {
            pipeline.generateInitialMaterials.mockRejectedValue(new Error('素材失败'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._body.data.allStepsSucceeded).toBe(false);
            const matStep = res._body.data.steps.find(s => s.step === 'materials');
            expect(matStep.status).toBe('failed');
            expect(matStep.error).toContain('素材失败');
            const outStep = res._body.data.steps.find(s => s.step === 'outlines');
            expect(outStep.status).toBe('ok');
        });

        test('大纲生成失败但素材成功', async () => {
            pipeline.generateChapterOutlines.mockRejectedValue(new Error('大纲失败'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._body.data.allStepsSucceeded).toBe(false);
            const outStep = res._body.data.steps.find(s => s.step === 'outlines');
            expect(outStep.status).toBe('failed');
        });

        test('主线任务初始化失败但其他步骤成功', async () => {
            autoInitProject.mockRejectedValue(new Error('任务初始化失败'));
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._statusCode).toBe(201);
            expect(res._body.data.allStepsSucceeded).toBe(false);
            const questStep = res._body.data.steps.find(s => s.step === 'quests');
            expect(questStep.status).toBe('failed');
            expect(questStep.error).toContain('任务初始化失败');
        });

        test('步骤结果缺字段时计数与安全字段降级为默认值', async () => {
            pipeline.generateInitialMaterials.mockResolvedValue({});
            pipeline.generateChapterOutlines.mockResolvedValue({});
            autoInitProject.mockResolvedValue({});
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._statusCode).toBe(201);
            expect(res._body.data.allStepsSucceeded).toBe(true);
            expect(res._body.data.steps[1].count).toBe(0);
            expect(res._body.data.steps[2].count).toBe(0);
            expect(res._body.data.steps[3].questsCreated).toBe(0);
            expect(res._body.data.steps[3].timelinesCreated).toBe(0);
            expect(res._body.data.steps[3].mainQuest).toBe('');
        });

        test('targetChapters 未传时为 null', async () => {
            await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(pipeline.generateChapterOutlines).toHaveBeenCalledWith('new-pid', '', null);
        });

        test('createProjectData 抛错返回 500', async () => {
            const { createProjectData } = require('../../../server/routes/projects/projectCreateHandler');
            createProjectData.mockImplementationOnce(() => { throw new Error('创建失败'); });
            const { res } = await executeRoute(getRoutes(), 'POST', '/initialize', { body: { name: '项目' } });
            expect(res._statusCode).toBe(500);
            expect(res._body.success).toBe(false);
        });
    });
});
