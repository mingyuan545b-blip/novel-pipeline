'use strict';

/**
 * overrideGovernance.test.js — override治理单元测试
 *
 * 验证点：
 *   1. 无历史记录时eligible=true
 *   2. 连续< threshold次eligible时eligible=true
 *   3. 连续>= threshold次eligible时eligible=false（核心治理逻辑）
 *   4. blocked记录会重置consecutive计数
 *   5. recordOverride正确记录并清理过期历史
 */

// Mock store
jest.mock('../../server/store', () => {
    const _data = new Map();
    return {
        setItem: jest.fn(async (type, id, value) => { _data.set(`${type}:${id}`, value); }),
        getItem: jest.fn(async (type, id) => _data.get(`${type}:${id}`) || null),
        _data,
    };
});

// Mock dataContext
const _mockProject = { id: 'test-project-1', overrideHistory: [] };
jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn(async () => ({
        getProject: jest.fn(async () => _mockProject),
    })),
    resetDataContext: jest.fn(),
}));

const { checkOverrideEligibility, recordOverride, OVERRIDE_GOVERNANCE_WINDOW, OVERRIDE_GOVERNANCE_THRESHOLD } = require('../../server/services/pipeline/overrideGovernance');

describe('overrideGovernance', () => {
    beforeEach(() => {
        _mockProject.overrideHistory = [];
    });

    describe('配置', () => {
        it('治理窗口应为3章', () => {
            expect(OVERRIDE_GOVERNANCE_WINDOW).toBe(3);
        });

        it('治理阈值应为3次', () => {
            expect(OVERRIDE_GOVERNANCE_THRESHOLD).toBe(3);
        });
    });

    describe('checkOverrideEligibility', () => {
        it('无历史记录时eligible=true', async () => {
            const result = await checkOverrideEligibility('test-project-1', 'perspective-violation');
            expect(result.eligible).toBe(true);
            expect(result.consecutiveCount).toBe(0);
        });

        it('连续2次eligible（< threshold=3）时eligible=true', async () => {
            _mockProject.overrideHistory = [
                { chapterNumber: 1, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 2, issueType: 'perspective-violation', governanceStatus: 'eligible' },
            ];
            const result = await checkOverrideEligibility('test-project-1', 'perspective-violation');
            expect(result.eligible).toBe(true);
            expect(result.consecutiveCount).toBe(2);
        });

        it('连续3次eligible（>= threshold=3）时eligible=false（核心治理）', async () => {
            _mockProject.overrideHistory = [
                { chapterNumber: 1, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 2, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 3, issueType: 'perspective-violation', governanceStatus: 'eligible' },
            ];
            const result = await checkOverrideEligibility('test-project-1', 'perspective-violation');
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('禁止override');
            expect(result.consecutiveCount).toBe(3);
        });

        it('blocked记录会中断consecutive计数', async () => {
            _mockProject.overrideHistory = [
                { chapterNumber: 1, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 2, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 3, issueType: 'perspective-violation', governanceStatus: 'blocked' },
            ];
            const result = await checkOverrideEligibility('test-project-1', 'perspective-violation');
            expect(result.eligible).toBe(true);
            expect(result.consecutiveCount).toBe(0);
        });

        it('不同issueType不互相影响', async () => {
            _mockProject.overrideHistory = [
                { chapterNumber: 1, issueType: 'other-issue', governanceStatus: 'eligible' },
                { chapterNumber: 2, issueType: 'other-issue', governanceStatus: 'eligible' },
                { chapterNumber: 3, issueType: 'other-issue', governanceStatus: 'eligible' },
            ];
            const result = await checkOverrideEligibility('test-project-1', 'perspective-violation');
            expect(result.eligible).toBe(true);
            expect(result.consecutiveCount).toBe(0);
        });

        it('空projectId或issueType时eligible=true', async () => {
            expect((await checkOverrideEligibility(null, 'type')).eligible).toBe(true);
            expect((await checkOverrideEligibility('pid', null)).eligible).toBe(true);
        });
    });

    describe('recordOverride', () => {
        it('应正确记录override到历史', async () => {
            await recordOverride('test-project-1', 5, 'perspective-violation', '测试原因', 'eligible');
            expect(_mockProject.overrideHistory).toHaveLength(1);
            expect(_mockProject.overrideHistory[0]).toMatchObject({
                chapterNumber: 5,
                issueType: 'perspective-violation',
                reason: '测试原因',
                governanceStatus: 'eligible',
            });
        });

        it('应清理超过窗口的过期记录', async () => {
            _mockProject.overrideHistory = [
                { chapterNumber: 1, issueType: 'perspective-violation', governanceStatus: 'eligible' },
                { chapterNumber: 2, issueType: 'perspective-violation', governanceStatus: 'eligible' },
            ];
            // 窗口=3，chapterNumber=5，recentCutoff=5-3=2，chapter<=2的记录会被清理
            await recordOverride('test-project-1', 5, 'perspective-violation', '新记录', 'eligible');
            // chapter 1 被清理（1 <= 2），chapter 2 被清理（2 <= 2），新增 chapter 5
            const chapters = _mockProject.overrideHistory.map(o => o.chapterNumber);
            expect(chapters).not.toContain(1);
            expect(chapters).toContain(5);
        });

        it('空projectId或issueType时不记录', async () => {
            _mockProject.overrideHistory = [];
            await recordOverride(null, 1, 'type', 'reason', 'eligible');
            await recordOverride('pid', 1, null, 'reason', 'eligible');
            expect(_mockProject.overrideHistory).toHaveLength(0);
        });
    });
});
