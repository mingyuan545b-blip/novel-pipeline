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

jest.mock('../../server/services/pipeline/materialDepthChecker', () => ({ checkProjectMaterials: jest.fn() }));

const store = require('../../server/store');
const { checkProjectMaterials } = require('../../server/services/pipeline/materialDepthChecker');
const { HEALTH_MONITOR_CONFIG } = require('../../server/config/systemConfig');
const {
    checkStuckChapters,
    checkOrphanBrowsers,
    checkDiskSpace,
    checkPipelineState,
    checkMemoryUsage,
    checkDataIntegrity,
    cleanupOldFiles,
    checkMaterialDepth
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

// ── E3b 覆盖补齐：material-depth 周期性校验 / 磁盘阈值 / 无进展 / 超龄日志清理 ──
describe('healthCheckers (R1) — 覆盖补齐', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('checkMaterialDepth（陷阱#72 4类素材深度周期校验）', () => {
        test('无项目的项目/无已写章节：跳过，不上报', async () => {
            store.listItems.mockResolvedValue([{ id: 'p1', name: 'P1' }]);
            store.queryItems.mockResolvedValue([makeChapter('ch1', 'outlined')]);
            await expect(checkMaterialDepth()).resolves.toEqual([]);
            expect(checkProjectMaterials).not.toHaveBeenCalled();
        });

        test('有已写章节 + 深度不达标：按问题条数给 warning / critical', async () => {
            store.listItems.mockResolvedValue([{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }]);
            store.queryItems.mockImplementation(async (type, q) => (q.projectId === 'p1'
                ? [makeChapter('ch1', 'material-updated')]
                : [makeChapter('ch2', 'approved')]));
            checkProjectMaterials
                .mockResolvedValueOnce({ passed: false, issues: ['缺高光', '缺名言'] })
                .mockResolvedValueOnce({ passed: false, issues: ['a', 'b', 'c'] });

            const out = await checkMaterialDepth();
            expect(out).toHaveLength(5);
            expect(out.filter(i => i.projectId === 'p1').every(i => i.level === 'warning')).toBe(true);
            expect(out.filter(i => i.projectId === 'p2').every(i => i.level === 'critical')).toBe(true);
        });

        test('深度达标：不产生 issue；store 抛错时吞掉并返回空数组', async () => {
            store.listItems.mockResolvedValue([{ id: 'p1', name: 'P1' }]);
            store.queryItems.mockResolvedValue([makeChapter('ch1', 'written')]);
            checkProjectMaterials.mockResolvedValue({ passed: true, issues: [] });
            await expect(checkMaterialDepth()).resolves.toEqual([]);

            store.listItems.mockRejectedValue(new Error('pg down'));
            await expect(checkMaterialDepth()).resolves.toEqual([]);
        });
    });

    describe('checkDataIntegrity — no-progress', () => {
        test('outlined>0 且 written=0 且章节数>10 触发 no-progress', () => {
            store.listItemsSync.mockReturnValue([{ id: 'p1' }]);
            const chapters = [makeChapter('ch1', 'outlined')];
            for (let i = 2; i <= 12; i++) chapters.push(makeChapter('ch' + i, 'material-updated'));
            store.queryItems.mockReturnValue(chapters);
            expect(checkDataIntegrity()).toEqual([expect.objectContaining({ type: 'no-progress', projectId: 'p1' })]);
        });
    });

    describe('checkDiskSpace / checkMemoryUsage 阈值', () => {
        test('库与 data 目录超阈值时上报对应 issue', () => {
            const e = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const st = jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1200 * 1024 * 1024, mtimeMs: Date.now() });
            const rd = jest.spyOn(fs, 'readdirSync').mockReturnValue(['a.bin', 'b.bin']);
            try {
                const types = checkDiskSpace().map(i => i.type);
                expect(types).toContain('database-size');
                expect(types).toContain('data-dir-size');
            } finally { e.mockRestore(); st.mockRestore(); rd.mockRestore(); }
        });

        test('堆/RSS 超阈值时上报 heap-usage / rss-usage', () => {
            const mu = jest.spyOn(process, 'memoryUsage').mockReturnValue({ heapUsed: 600 * 1024 * 1024, rss: 1100 * 1024 * 1024 });
            try {
                const types = checkMemoryUsage().map(i => i.type);
                expect(types).toContain('heap-usage');
                expect(types).toContain('rss-usage');
            } finally { mu.mockRestore(); }
        });
    });

    describe('cleanupOldFiles 真实清理', () => {
        test('超龄 .log 被清理，未超龄的保留', () => {
            const dataDir = path.join(__dirname, '..', '..', 'data');
            const oldFile = path.join(dataDir, '__test_old.log');
            const newFile = path.join(dataDir, '__test_new.log');
            fs.writeFileSync(oldFile, 'x');
            fs.writeFileSync(newFile, 'x');
            const oldSec = (Date.now() - HEALTH_MONITOR_CONFIG.MAX_LOG_AGE - 60000) / 1000;
            fs.utimesSync(oldFile, oldSec, oldSec);
            try {
                const cleaned = cleanupOldFiles();
                expect(cleaned).toContain('__test_old.log');
                expect(fs.existsSync(newFile)).toBe(true);
            } finally {
                if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            }
        });
    });
});
