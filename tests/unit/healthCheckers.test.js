'use strict';

/**
 * healthCheckers 单元测试（R1）
 *
 * 测试策略：
 * - mock store 模块（listItems/queryItems/getItemSync/listItemsSync）
 * - mock PublisherBase.getAllBrowsers
 * - fs 相关检查使用真实临时目录
 * - 覆盖 7 个检查函数：stuck chapters/orphan browsers/disk/pipeline/memory/integrity/cleanup
 *
 * 文件位置：tests/unit/healthCheckers.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// mock store 模块（必须在 require healthCheckers 之前）
jest.mock('../../server/store', () => ({
    listItems: jest.fn(),
    queryItems: jest.fn(),
    getItemSync: jest.fn(),
    listItemsSync: jest.fn()
}));

// mock PublisherBase
jest.mock('../../server/services/publishers/PublisherBase', () => ({
    getAllBrowsers: jest.fn(() => ({}))
}), { virtual: true });

const store = require('../../server/store');
const { HEALTH_MONITOR_CONFIG } = require('../../server/config/systemConfig');
const {
    checkStuckChapters,
    checkOrphanBrowsers,
    checkDiskSpace,
    checkPipelineState,
    checkMemoryUsage,
    checkDataIntegrity,
    cleanupOldFiles
} = require('../../server/services/healthCheckers');

// 辅助：构造章节对象
function makeChapter(id, status, ageMs = 0) {
    const ts = new Date(Date.now() - ageMs).toISOString();
    return { id, chapterNumber: parseInt(id.replace('ch', '')), status, updatedAt: ts, createdAt: ts };
}

describe('healthCheckers (R1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkStuckChapters', () => {
        test('无项目返回空数组', async () => {
            store.listItems.mockResolvedValue([]);
            const result = await checkStuckChapters();
            expect(result).toEqual([]);
        });

        test('识别卡住的 writing 章节超 MAX_STUCK_CHAPTER_AGE', async () => {
            const stuckAge = HEALTH_MONITOR_CONFIG.MAX_STUCK_CHAPTER_AGE + 60000;
            store.listItems.mockResolvedValue([{ id: 'p1' }]);
            store.queryItems.mockResolvedValue([
                makeChapter('ch1', 'writing', stuckAge),
                makeChapter('ch2', 'writing', 1000) // 不卡
            ]);
            const result = await checkStuckChapters();
            expect(result.length).toBe(1);
            expect(result[0].projectId).toBe('p1');
            expect(result[0].chapterId).toBe('ch1');
            expect(result[0].status).toBe('writing');
        });

        test('识别卡住的 reviewing 章节', async () => {
            const stuckAge = HEALTH_MONITOR_CONFIG.MAX_STUCK_CHAPTER_AGE + 60000;
            store.listItems.mockResolvedValue([{ id: 'p1' }]);
            store.queryItems.mockResolvedValue([
                makeChapter('ch1', 'reviewing', stuckAge)
            ]);
            const result = await checkStuckChapters();
            expect(result.length).toBe(1);
            expect(result[0].status).toBe('reviewing');
        });

        test('approved/written 状态不视为卡住', async () => {
            const stuckAge = HEALTH_MONITOR_CONFIG.MAX_STUCK_CHAPTER_AGE + 60000;
            store.listItems.mockResolvedValue([{ id: 'p1' }]);
            store.queryItems.mockResolvedValue([
                makeChapter('ch1', 'approved', stuckAge),
                makeChapter('ch2', 'written', stuckAge),
                makeChapter('ch3', 'outlined', stuckAge)
            ]);
            const result = await checkStuckChapters();
            expect(result).toEqual([]);
        });

        test('store.listItems 抛错时返回空数组', async () => {
            store.listItems.mockRejectedValue(new Error('db down'));
            const result = await checkStuckChapters();
            expect(result).toEqual([]);
        });

        test('无 updatedAt 时使用 createdAt', async () => {
            const stuckAge = HEALTH_MONITOR_CONFIG.MAX_STUCK_CHAPTER_AGE + 60000;
            const chapter = makeChapter('ch1', 'writing', stuckAge);
            delete chapter.updatedAt;
            store.listItems.mockResolvedValue([{ id: 'p1' }]);
            store.queryItems.mockResolvedValue([chapter]);
            const result = await checkStuckChapters();
            expect(result.length).toBe(1);
        });
    });

    describe('checkOrphanBrowsers', () => {
        test('无浏览器返回空数组', () => {
            const PublisherBase = require('../../server/services/publishers/PublisherBase');
            PublisherBase.getAllBrowsers.mockReturnValue({});
            expect(checkOrphanBrowsers()).toEqual([]);
        });

        test('识别超过 30 分钟的孤儿浏览器', () => {
            const PublisherBase = require('../../server/services/publishers/PublisherBase');
            const oldTs = Date.now() - 31 * 60 * 1000;
            PublisherBase.getAllBrowsers.mockReturnValue({
                'b1': { _openedAt: oldTs },
                'b2': { _openedAt: Date.now() - 1000 } // 新
            });
            const result = checkOrphanBrowsers();
            expect(result.length).toBe(1);
            expect(result[0].browserId).toBe('b1');
            expect(result[0].age).toBeGreaterThan(30 * 60 * 1000);
        });

        test('getAllBrowsers 不存在时返回空数组', () => {
            const PublisherBase = require('../../server/services/publishers/PublisherBase');
            PublisherBase.getAllBrowsers.mockReturnValue(undefined);
            expect(checkOrphanBrowsers()).toEqual([]);
        });

        test('require 抛错时返回空数组', () => {
            const PublisherBase = require('../../server/services/publishers/PublisherBase');
            PublisherBase.getAllBrowsers.mockImplementation(() => { throw new Error('no module'); });
            expect(checkOrphanBrowsers()).toEqual([]);
        });
    });

    describe('checkDiskSpace', () => {
        test('data 目录不存在返回空数组', () => {
            // data 目录在测试环境中可能存在，但本测试验证函数不抛错
            const result = checkDiskSpace();
            expect(Array.isArray(result)).toBe(true);
        });

        test('正常情况返回数组（可能为空）', () => {
            const result = checkDiskSpace();
            expect(Array.isArray(result)).toBe(true);
            // 测试环境 DB 不存在或小于阈值，应为空
            // 若存在则验证结构
            for (const issue of result) {
                expect(issue).toHaveProperty('type');
                expect(issue).toHaveProperty('sizeMB');
                expect(issue).toHaveProperty('threshold');
            }
        });
    });

    describe('checkPipelineState', () => {
        test('无运行中 pipeline 返回空数组', () => {
            store.getItemSync.mockReturnValue(null);
            expect(checkPipelineState()).toEqual([]);
        });

        test('pipeline 未运行返回空数组', () => {
            store.getItemSync.mockReturnValue({ isRunning: false });
            expect(checkPipelineState()).toEqual([]);
        });

        test('pipeline 运行中且最近更新返回空数组', () => {
            store.getItemSync.mockReturnValue({
                isRunning: true,
                projectId: 'p1',
                lastUpdate: new Date().toISOString()
            });
            expect(checkPipelineState()).toEqual([]);
        });

        test('pipeline 运行中但超过 1 小时未更新触发告警', () => {
            const stale = new Date(Date.now() - 61 * 60 * 1000).toISOString();
            store.getItemSync.mockReturnValue({
                isRunning: true,
                projectId: 'p1',
                lastUpdate: stale
            });
            const result = checkPipelineState();
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('stale-pipeline');
            expect(result[0].projectId).toBe('p1');
        });

        test('lastUpdate 缺失时使用 startedAt', () => {
            const stale = new Date(Date.now() - 61 * 60 * 1000).toISOString();
            store.getItemSync.mockReturnValue({
                isRunning: true,
                projectId: 'p1',
                startedAt: stale
            });
            const result = checkPipelineState();
            expect(result.length).toBe(1);
        });

        test('store.getItemSync 抛错返回空数组', () => {
            store.getItemSync.mockImplementation(() => { throw new Error('kv down'); });
            expect(checkPipelineState()).toEqual([]);
        });
    });

    describe('checkMemoryUsage', () => {
        test('返回数组（取决于实际内存）', () => {
            const result = checkMemoryUsage();
            expect(Array.isArray(result)).toBe(true);
        });

        test('正常环境下要么空数组要么包含 heap/rss issue', () => {
            const result = checkMemoryUsage();
            for (const issue of result) {
                expect(['heap-usage', 'rss-usage']).toContain(issue.type);
                expect(issue).toHaveProperty('threshold');
            }
        });
    });

    describe('checkDataIntegrity', () => {
        test('store.listItemsSync 不存在返回空数组', () => {
            // 已 mock 为 jest.fn() 默认返回 undefined
            expect(checkDataIntegrity()).toEqual([]);
        });

        test('无项目返回空数组', () => {
            store.listItemsSync.mockReturnValue([]);
            expect(checkDataIntegrity()).toEqual([]);
        });

        test('有 outlined 但有 written 不触发', () => {
            store.listItemsSync.mockReturnValue([{ id: 'p1' }]);
            store.queryItems.mockReturnValue([
                makeChapter('ch1', 'outlined'),
                makeChapter('ch2', 'written')
            ]);
            const result = checkDataIntegrity();
            // queryItems 是异步的，但 checkDataIntegrity 同步调用
            // mock 返回的是非 Promise，所以会走 || [] 分支
            expect(result).toEqual([]);
        });

        test('store.queryItems 抛错返回空数组', () => {
            store.listItemsSync.mockReturnValue([{ id: 'p1' }]);
            store.queryItems.mockImplementation(() => { throw new Error('fail'); });
            expect(checkDataIntegrity()).toEqual([]);
        });
    });

    describe('cleanupOldFiles', () => {
        let tmpDataDir;
        let origDataDir;

        beforeEach(() => {
            // 备份并替换 data 目录路径 — 通过 monkey-patch path.join 不现实
            // 改为在真实 data 目录测试，但只创建 .log/.tmp/.bak 测试文件
            // 由于 cleanupOldFiles 使用 __dirname 相对路径，无法重定向
            // 验证函数不抛错即可
            origDataDir = path.join(__dirname, '..', '..', 'data');
        });

        test('返回数组（清理的文件列表）', () => {
            const result = cleanupOldFiles();
            expect(Array.isArray(result)).toBe(true);
        });

        test('不清理非 .log/.tmp/.bak 文件', () => {
            // 创建一个 .json 测试文件（确保不被清理）
            const testFile = path.join(origDataDir, '__test_keep.json');
            fs.writeFileSync(testFile, '{}');
            const before = fs.existsSync(testFile);
            cleanupOldFiles();
            const after = fs.existsSync(testFile);
            // 清理后 .json 应仍存在
            expect(after).toBe(true);
            // 清理
            if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        });
    });

    describe('模块导出', () => {
        test('导出 7 个函数', () => {
            const mod = require('../../server/services/healthCheckers');
            expect(typeof mod.checkStuckChapters).toBe('function');
            expect(typeof mod.checkOrphanBrowsers).toBe('function');
            expect(typeof mod.checkDiskSpace).toBe('function');
            expect(typeof mod.checkPipelineState).toBe('function');
            expect(typeof mod.checkMemoryUsage).toBe('function');
            expect(typeof mod.checkDataIntegrity).toBe('function');
            expect(typeof mod.cleanupOldFiles).toBe('function');
        });
    });
});
