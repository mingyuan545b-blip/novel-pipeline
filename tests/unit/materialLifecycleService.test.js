'use strict';

/**
 * materialLifecycleService 单元测试（R4）
 *
 * 测试策略：
 * - mock store 模块（queryItems/getItem/setItem）
 * - mock materialBudgetCalc.calculateTokenBudget
 * - 覆盖 getMaterialActivityAnalysis/archiveStaleMaterials/detectDuplicateMaterials/getHealthReport/_computeSimilarity
 *
 * 文件位置：tests/unit/materialLifecycleService.test.js
 */

jest.mock('../../server/store', () => ({
    queryItems: jest.fn(),
    getItem: jest.fn(),
    setItem: jest.fn()
}));

// mock calculateTokenBudget 避免触发 styleProfile 链
jest.mock('../../server/services/materialBudgetCalc', () => ({
    LIFECYCLE_CONFIG: {
        DECAY_THRESHOLD_CHAPTERS: 15,
        ARCHIVE_THRESHOLD_CHAPTERS: 30,
        MAX_TOKEN_BUDGET: 4000,
        MIN_TOKEN_BUDGET: 1500,
        TYPE_BUDGETS: { character: 800, 'power-system': 400, setting: 400, 'other': 200 },
        MERGE_SIMILARITY_THRESHOLD: 0.8
    },
    calculateTokenBudget: jest.fn().mockResolvedValue({
        totalBudget: 2000, budgetAllocation: { character: 800 }, typeCounts: { character: 1 }, totalMaterials: 1
    })
}));

const store = require('../../server/store');
const { materialLifecycleService, MaterialLifecycleService, LIFECYCLE_CONFIG } = require('../../server/services/materialLifecycleService');
const { calculateTokenBudget } = require('../../server/services/materialBudgetCalc');

// 构造素材对象
function makeMaterial(id, name, type, opts = {}) {
    return {
        id, name, type,
        archived: opts.archived || false,
        isArchived: opts.archived || false,
        lastReferencedChapter: opts.lastRef,
        createdChapter: opts.createdChapter || 1,
        referenceCount: opts.refCount || 0,
        baseState: opts.baseState
    };
}

describe('materialLifecycleService (R4)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        calculateTokenBudget.mockResolvedValue({
            totalBudget: 2000, budgetAllocation: {}, typeCounts: {}, totalMaterials: 0
        });
    });

    describe('LIFECYCLE_CONFIG', () => {
        test('包含关键阈值', () => {
            expect(LIFECYCLE_CONFIG.DECAY_THRESHOLD_CHAPTERS).toBe(15);
            expect(LIFECYCLE_CONFIG.ARCHIVE_THRESHOLD_CHAPTERS).toBe(30);
            expect(LIFECYCLE_CONFIG.MERGE_SIMILARITY_THRESHOLD).toBe(0.8);
        });
    });

    describe('getMaterialActivityAnalysis', () => {
        test('无素材返回空数组', async () => {
            store.queryItems.mockResolvedValue([]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 10);
            expect(result).toEqual([]);
        });

        test('过滤已归档素材', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { archived: true }),
                makeMaterial('m2', '配角', 'character')
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 10);
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('m2');
        });

        test('recent 引用 → active 状态', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 18, createdChapter: 1 })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 20);
            expect(result[0].status).toBe('active');
            expect(result[0].refGap).toBe(2); // 20-18
            expect(result[0].age).toBe(19); // 20-1
        });

        test('refGap > DECAY_THRESHOLD → decaying', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 20);
            // refGap = 20-1=19 > 15 → decaying
            expect(result[0].status).toBe('decaying');
        });

        test('refGap > ARCHIVE_THRESHOLD → archive_candidate', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 35);
            // refGap = 35-1=34 > 30 → archive_candidate
            expect(result[0].status).toBe('archive_candidate');
        });

        test('lastRef=0 时 refGap=age', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 0, createdChapter: 1 })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 20);
            expect(result[0].refGap).toBe(19); // age = 20-1
        });

        test('baseState.lastReferencedChapter 作为 fallback', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', {
                    lastRef: undefined,
                    baseState: { lastReferencedChapter: 18, referenceCount: 5 }
                })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 20);
            expect(result[0].lastReferencedChapter).toBe(18);
            expect(result[0].referenceCount).toBe(5);
        });

        test('返回完整字段', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 5, createdChapter: 1, refCount: 3 })
            ]);
            const result = await materialLifecycleService.getMaterialActivityAnalysis('p1', 10);
            expect(result[0]).toHaveProperty('id', 'm1');
            expect(result[0]).toHaveProperty('name', '主角');
            expect(result[0]).toHaveProperty('type', 'character');
            expect(result[0]).toHaveProperty('status');
            expect(result[0]).toHaveProperty('age');
            expect(result[0]).toHaveProperty('refGap');
            expect(result[0]).toHaveProperty('lastReferencedChapter', 5);
            expect(result[0]).toHaveProperty('referenceCount', 3);
        });
    });

    describe('archiveStaleMaterials', () => {
        test('无 archive_candidate 返回空数组', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 18, createdChapter: 1 })
            ]);
            const result = await materialLifecycleService.archiveStaleMaterials('p1', 20);
            expect(result).toEqual([]);
            expect(store.setItem).not.toHaveBeenCalled();
        });

        test('归档 archive_candidate 素材', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            store.getItem.mockResolvedValue(makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 }));
            const result = await materialLifecycleService.archiveStaleMaterials('p1', 35);
            expect(result).toEqual(['m1']);
            expect(store.setItem).toHaveBeenCalledTimes(1);
            const setItemArgs = store.setItem.mock.calls[0];
            expect(setItemArgs[0]).toBe('materials');
            expect(setItemArgs[1]).toBe('m1');
            expect(setItemArgs[2].isArchived).toBe(true);
            expect(setItemArgs[2].archivedAt).toBeTruthy();
            expect(setItemArgs[2].archivedReason).toContain('章未引用');
        });

        test('已归档素材不重复归档', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            store.getItem.mockResolvedValue(makeMaterial('m1', '主角', 'character', {
                lastRef: 1, createdChapter: 1, archived: true, isArchived: true
            }));
            const result = await materialLifecycleService.archiveStaleMaterials('p1', 35);
            expect(result).toEqual([]);
            expect(store.setItem).not.toHaveBeenCalled();
        });

        test('store.getItem 抛错不阻塞其他', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 }),
                makeMaterial('m2', '配角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            store.getItem.mockImplementation(async (coll, id) => {
                if (id === 'm1') throw new Error('db error');
                return makeMaterial('m2', '配角', 'character', { lastRef: 1, createdChapter: 1 });
            });
            const result = await materialLifecycleService.archiveStaleMaterials('p1', 35);
            expect(result).toEqual(['m2']);
        });
    });

    describe('detectDuplicateMaterials', () => {
        test('无素材返回空数组', async () => {
            store.queryItems.mockResolvedValue([]);
            const result = await materialLifecycleService.detectDuplicateMaterials('p1');
            expect(result).toEqual([]);
        });

        test('相似度 >= 0.8 触发重复检测', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '张三的剑', 'item'),
                makeMaterial('m2', '张三的宝剑', 'item')   // 字符集：并集 5、交集 4 → Jaccard 0.8
            ]);
            const result = await materialLifecycleService.detectDuplicateMaterials('p1');
            // 相似度实现是字符集 Jaccard（交集/并集），阈值 0.8
            // （原夹具"张三的剑 vs 张三之剑"实为 3/5=0.6，注释写错；因断言在 if 内从未执行 → 假测试掩盖了错夹具）
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].similarity).toBeGreaterThanOrEqual(0.8);
            expect(result[0].materials.length).toBe(2);
            expect(result[0].suggestion).toContain('合并');
        });

        test('不相似素材不触发', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', 'abc', 'item'),
                makeMaterial('m2', 'xyz', 'item')
            ]);
            const result = await materialLifecycleService.detectDuplicateMaterials('p1');
            expect(result).toEqual([]);
        });

        test('不同类型素材不互相比较', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '张三', 'character'),
                makeMaterial('m2', '张三', 'item') // 同名但不同类型
            ]);
            const result = await materialLifecycleService.detectDuplicateMaterials('p1');
            expect(result).toEqual([]);
        });

        test('type 缺失归为 other', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '张三', null),
                makeMaterial('m2', '张三', undefined)
            ]);
            const result = await materialLifecycleService.detectDuplicateMaterials('p1');
            // 都归为 other，会互相比较
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('other');
        });
    });

    describe('calculateTokenBudget', () => {
        test('委托给 materialBudgetCalc.calculateTokenBudget', async () => {
            calculateTokenBudget.mockResolvedValue({ totalBudget: 3000, budgetAllocation: {}, typeCounts: {}, totalMaterials: 5 });
            const result = await materialLifecycleService.calculateTokenBudget('p1', 10);
            expect(calculateTokenBudget).toHaveBeenCalledWith('p1', 10);
            expect(result.totalBudget).toBe(3000);
        });
    });

    describe('getHealthReport', () => {
        test('返回完整健康报告结构', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 18, createdChapter: 1 }),
                makeMaterial('m2', '配角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            calculateTokenBudget.mockResolvedValue({ totalBudget: 2000, budgetAllocation: {}, typeCounts: {}, totalMaterials: 2 });
            const report = await materialLifecycleService.getHealthReport('p1', 20);
            expect(report).toHaveProperty('total');
            expect(report).toHaveProperty('active');
            expect(report).toHaveProperty('decaying');
            expect(report).toHaveProperty('archiveCandidates');
            expect(report).toHaveProperty('duplicates');
            expect(report).toHaveProperty('budget');
            expect(report).toHaveProperty('suggestions');
            expect(Array.isArray(report.suggestions)).toBe(true);
        });

        test('archiveCandidates > 0 时 suggestion 包含归档建议', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            const report = await materialLifecycleService.getHealthReport('p1', 35);
            // archive_candidate: refGap=34 > 30
            expect(report.archiveCandidates).toBe(1);
            expect(report.suggestions.some(s => s.includes('归档'))).toBe(true);
        });

        test('decaying > 0 时 suggestion 包含衰减建议', async () => {
            store.queryItems.mockResolvedValue([
                makeMaterial('m1', '主角', 'character', { lastRef: 1, createdChapter: 1 })
            ]);
            const report = await materialLifecycleService.getHealthReport('p1', 20);
            // decaying: refGap=19 > 15
            expect(report.decaying).toBe(1);
            expect(report.suggestions.some(s => s.includes('衰减'))).toBe(true);
        });

        test('无素材时返回全 0 报告', async () => {
            store.queryItems.mockResolvedValue([]);
            const report = await materialLifecycleService.getHealthReport('p1', 10);
            expect(report.total).toBe(0);
            expect(report.active).toBe(0);
            expect(report.decaying).toBe(0);
            expect(report.archiveCandidates).toBe(0);
            expect(report.duplicates).toBe(0);
            expect(report.suggestions).toEqual([]);
        });
    });

    describe('_computeSimilarity', () => {
        test('完全相同返回 1', () => {
            expect(materialLifecycleService._computeSimilarity('abc', 'abc')).toBe(1);
        });

        test('完全不同返回 0', () => {
            expect(materialLifecycleService._computeSimilarity('abc', 'xyz')).toBe(0);
        });

        test('部分相同返回 0-1 之间', () => {
            const sim = materialLifecycleService._computeSimilarity('abcd', 'abxy');
            // 交集 {a,b} = 2，并集 {a,b,c,d,x,y} = 6 → 0.333
            expect(sim).toBeCloseTo(2/6, 5);
        });

        test('空字符串返回 0', () => {
            expect(materialLifecycleService._computeSimilarity('', 'abc')).toBe(0);
            expect(materialLifecycleService._computeSimilarity('abc', '')).toBe(0);
            expect(materialLifecycleService._computeSimilarity('', '')).toBe(0);
        });

        test('null/undefined 返回 0', () => {
            expect(materialLifecycleService._computeSimilarity(null, 'abc')).toBe(0);
            expect(materialLifecycleService._computeSimilarity('abc', undefined)).toBe(0);
        });
    });

    describe('模块导出', () => {
        test('导出单例和类', () => {
            expect(materialLifecycleService).toBeInstanceOf(MaterialLifecycleService);
        });

        test('导出 LIFECYCLE_CONFIG', () => {
            const mod = require('../../server/services/materialLifecycleService');
            expect(mod.LIFECYCLE_CONFIG).toBeDefined();
            expect(mod.LIFECYCLE_CONFIG).toBe(LIFECYCLE_CONFIG);
        });
    });
});
