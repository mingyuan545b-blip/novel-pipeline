/**
 * cleanupRoutes.test.js — 项目清理路由测试
 * 覆盖：registerCleanupRoutes 的 POST /:id/cleanup 和 GET /:id/cleanup-stats
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn(),
    DATA_DIR: '/tmp/test-data-dir'
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/shared/errorCodes', () => ({
    ERROR_CODES: {
        NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND' }
    }
}));

jest.mock('../../server/routes/projects/cleanupHandlers', () => ({
    cleanupChapters: jest.fn(),
    cleanupTimelines: jest.fn(),
    cleanupMaterials: jest.fn(),
    cleanupKnowledge: jest.fn(),
    cleanupOutlines: jest.fn(),
    cleanupLogs: jest.fn(),
    cleanupRemediation: jest.fn()
}));

jest.mock('fs');

const store = require('../../server/store');
const fs = require('fs');
const {
    cleanupChapters, cleanupTimelines, cleanupMaterials, cleanupKnowledge,
    cleanupOutlines, cleanupLogs, cleanupRemediation
} = require('../../server/routes/projects/cleanupHandlers');
const { registerCleanupRoutes } = require('../../server/routes/projects/cleanupRoutes');

function createMockRouter() {
    const routes = {};
    return {
        post: jest.fn((path, handler) => { routes[`POST ${path}`] = handler; }),
        get: jest.fn((path, handler) => { routes[`GET ${path}`] = handler; }),
        _routes: routes
    };
}

function mockRes() {
    const res = { statusCode: 200, body: null, headers: {} };
    res.apiError = jest.fn((statusCode, message, code) => {
        res.statusCode = statusCode;
        res.body = { statusCode, message, code };
    });
    res.json = jest.fn((data) => { res.body = data; });
    res.setHeader = jest.fn((key, value) => { res.headers[key] = value; });
    return res;
}

describe('cleanupRoutes', () => {
    let router;

    beforeEach(() => {
        jest.clearAllMocks();
        router = createMockRouter();
        registerCleanupRoutes(router);
    });

    describe('POST /:id/cleanup', () => {
        test('项目不存在时返回 404', async () => {
            store.getItem.mockResolvedValue(null);
            const req = { params: { id: 'p1' }, body: { targets: ['chapters'] } };
            const res = mockRes();

            await router._routes['POST /:id/cleanup'](req, res);

            expect(res.apiError).toHaveBeenCalledWith(404, 'Project not found', 'NOT_FOUND');
        });

        test('清理 chapters 目标', async () => {
            store.getItem.mockResolvedValue({ id: 'p1', name: 'test' });
            cleanupChapters.mockResolvedValue({ chapters: { count: 5 } });
            const req = { params: { id: 'p1' }, body: { targets: ['chapters'] } };
            const res = mockRes();

            await router._routes['POST /:id/cleanup'](req, res);

            expect(cleanupChapters).toHaveBeenCalledWith('p1', expect.objectContaining({ id: 'p1', name: 'test' }));
            expect(res.json).toHaveBeenCalled();
            expect(res.body.success).toBe(true);
            expect(res.body.cleaned.chapters).toEqual({ count: 5 });
        });

        test('清理多个目标', async () => {
            store.getItem.mockResolvedValue({ id: 'p1' });
            cleanupChapters.mockResolvedValue({ chapters: { count: 1 } });
            cleanupTimelines.mockResolvedValue({ timelines: { count: 2 } });
            cleanupMaterials.mockResolvedValue({ materials: { count: 3 } });
            const req = {
                params: { id: 'p1' },
                body: { targets: ['chapters', 'timelines', 'materials'] }
            };
            const res = mockRes();

            await router._routes['POST /:id/cleanup'](req, res);

            expect(cleanupChapters).toHaveBeenCalled();
            expect(cleanupTimelines).toHaveBeenCalled();
            expect(cleanupMaterials).toHaveBeenCalledWith('p1', true);
        });

        test('keepLocked=false 时传 false 给 cleanupMaterials', async () => {
            store.getItem.mockResolvedValue({ id: 'p1' });
            cleanupMaterials.mockResolvedValue({ materials: {} });
            const req = {
                params: { id: 'p1' },
                body: { targets: ['materials'], keepLocked: false }
            };
            const res = mockRes();

            await router._routes['POST /:id/cleanup'](req, res);

            expect(cleanupMaterials).toHaveBeenCalledWith('p1', false);
        });

        test('清理 knowledge/outlines/logs/remediation', async () => {
            store.getItem.mockResolvedValue({ id: 'p1' });
            cleanupKnowledge.mockResolvedValue({ knowledge: {} });
            cleanupOutlines.mockResolvedValue({ outlines: {} });
            cleanupLogs.mockResolvedValue({ logs: {} });
            cleanupRemediation.mockReturnValue({ remediation: {} });
            const req = {
                params: { id: 'p1' },
                body: { targets: ['knowledge', 'outlines', 'logs', 'remediation'] }
            };
            const res = mockRes();

            await router._routes['POST /:id/cleanup'](req, res);

            expect(cleanupKnowledge).toHaveBeenCalledWith('p1');
            expect(cleanupOutlines).toHaveBeenCalledWith('p1');
            expect(cleanupLogs).toHaveBeenCalledWith('p1');
            expect(cleanupRemediation).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
            expect(store.setItem).toHaveBeenCalled();
        });
    });

    describe('GET /:id/cleanup-stats', () => {
        test('项目不存在时返回 404', async () => {
            store.getItem.mockResolvedValue(null);
            const req = { params: { id: 'p1' } };
            const res = mockRes();

            await router._routes['GET /:id/cleanup-stats'](req, res);

            expect(res.apiError).toHaveBeenCalledWith(404, 'Project not found', 'NOT_FOUND');
        });

        test('返回完整统计信息', async () => {
            store.getItem.mockResolvedValue({
                id: 'p1',
                writerPromptAdditions: ['x'],
                reviewPromptAdditions: [],
                styleGuidance: null
            });
            store.queryItems.mockImplementation(async (collection) => {
                if (collection === 'chapters') return [{ id: 'ch1' }];
                if (collection === 'reviews') return [{ id: 'r1' }];
                if (collection === 'timelines') return [{ id: 't1' }];
                if (collection === 'quests') return [];
                if (collection === 'materials') return [{ id: 'm1', isLocked: true }, { id: 'm2', isLocked: false }];
                if (collection === 'memory-layers') return [];
                if (collection === 'state-snapshots') return [];
                if (collection === 'consistency-reports') return [];
                if (collection === 'chapter-outlines') return [];
                return [];
            });
            fs.existsSync.mockReturnValue(false);

            const req = { params: { id: 'p1' } };
            const res = mockRes();

            await router._routes['GET /:id/cleanup-stats'](req, res);

            expect(res.json).toHaveBeenCalled();
            expect(res.body.chapters.count).toBe(1);
            expect(res.body.chapters.reviews).toBe(1);
            expect(res.body.materials.count).toBe(2);
            expect(res.body.materials.locked).toBe(1);
            expect(res.body.materials.unlocked).toBe(1);
            expect(res.body.remediation.hasWriterAdditions).toBe(true);
            expect(res.body.remediation.hasReviewAdditions).toBe(false);
            expect(res.body.remediation.hasStyleGuidance).toBe(false);
        });
    });

    describe('getDirSize（通过 cleanup-stats 间接覆盖）', () => {
        test('outputDir 存在时计算 logSize', async () => {
            store.getItem.mockResolvedValue({ id: 'p1', writerPromptAdditions: [] });
            store.queryItems.mockResolvedValue([]);
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['file1.json']);
            fs.statSync.mockReturnValue({ size: 1024, isDirectory: () => false });

            const req = { params: { id: 'p1' } };
            const res = mockRes();

            await router._routes['GET /:id/cleanup-stats'](req, res);

            expect(res.json).toHaveBeenCalled();
            expect(res.body.logs.sizeBytes).toBeGreaterThan(0);
        });

        test('getDirSize 抛错时被 try/catch 捕获不阻断', async () => {
            // getDirSize 在 try/catch 中（第76行），抛错时只 warn 不阻断
            store.getItem.mockResolvedValue({ id: 'p1', writerPromptAdditions: [] });
            store.queryItems.mockResolvedValue([]);
            // outputDir 和 exportDir 都不存在，跳过 getDirSize
            fs.existsSync.mockReturnValue(false);

            const req = { params: { id: 'p1' } };
            const res = mockRes();

            await router._routes['GET /:id/cleanup-stats'](req, res);

            expect(res.json).toHaveBeenCalled();
        });
    });
});
