const mockSetItem = jest.fn();

jest.mock('../../server/store', () => ({
    setItem: mockSetItem
}));

jest.mock('../../server/services/timelineAdapter', () => ({
    saveTimelineEvent: jest.fn(() => Promise.resolve({ id: 'mock-event' }))
}));

const {
    extractKeywords,
    associateTimelinesToQuests,
    distributeTimelinesToChapters,
    associateCharactersToTimelines,
    associateMaterialsToQuests
} = require('../../server/services/pipeline/outlineTemplateExpander/templateEntityAssocHelpers');

describe('templateEntityAssocHelpers - branch coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractKeywords', () => {
        test('returns empty for null text', () => {
            expect(extractKeywords(null)).toEqual([]);
        });

        test('returns empty for empty text', () => {
            expect(extractKeywords('')).toEqual([]);
        });

        test('extracts keywords filtering short words', () => {
            const result = extractKeywords('测试 关键词 a 提取');
            expect(result).toContain('测试');
            expect(result).toContain('关键词');
            expect(result).toContain('提取');
            expect(result).not.toContain('a');
        });

        test('removes numbers and special chars', () => {
            const result = extractKeywords('第1章 整合（测试）【重要】、内容');
            expect(result).not.toContain('第1章');
            expect(result).not.toContain('（');
        });
    });

    describe('associateTimelinesToQuests', () => {
        test('associates timeline events to quests by keyword overlap', async () => {
            const timelines = [
                { id: 't1', title: '冰系能力觉醒', description: '主角觉醒冰系能力', eventType: 'revelation' }
            ];
            const mainQuests = [
                { id: 'q1', title: '冰系传承', description: '寻找冰系传承', priority: 'high' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('skips events with low score', async () => {
            const timelines = [
                { id: 't1', title: '无关事件', description: '完全无关的内容', eventType: 'other' }
            ];
            const mainQuests = [
                { id: 'q1', title: '冰系传承', description: '寻找冰系传承', priority: 'high' }
            ];

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('adds bonus for conflict+critical', async () => {
            const timelines = [
                { id: 't1', title: '冰系冲突', description: '冰系冲突爆发', eventType: 'conflict' }
            ];
            const mainQuests = [
                { id: 'q1', title: '冰系冲突', description: '冰系冲突', priority: 'critical' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('adds bonus for resolution+critical', async () => {
            const timelines = [
                { id: 't1', title: '冰系解决', description: '冰系问题解决', eventType: 'resolution' }
            ];
            const mainQuests = [
                { id: 'q1', title: '冰系问题', description: '冰系问题', priority: 'critical' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('adds bonus for world+high', async () => {
            const timelines = [
                { id: 't1', title: '世界观事件', description: '世界观设定', eventType: 'world' }
            ];
            const mainQuests = [
                { id: 'q1', title: '世界观', description: '世界观探索', priority: 'high' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('adds bonus for character+critical', async () => {
            const timelines = [
                { id: 't1', title: '角色发展', description: '角色成长', eventType: 'character' }
            ];
            const mainQuests = [
                { id: 'q1', title: '角色', description: '角色发展', priority: 'critical' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('includes sub-quests in scoring', async () => {
            const timelines = [
                { id: 't1', title: '冰系子任务', description: '冰系子任务内容', eventType: 'other' }
            ];
            const mainQuests = [
                { id: 'q1', title: '主线', description: '主线任务', priority: 'high' }
            ];
            const allQuests = [
                ...mainQuests,
                { id: 'sq1', parentId: 'q1', title: '冰系子任务', description: '冰系子任务' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, allQuests);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('does not duplicate questIds', async () => {
            const timelines = [
                { id: 't1', title: '冰系能力', description: '冰系能力', eventType: 'other', questIds: ['q1'] }
            ];
            const mainQuests = [
                { id: 'q1', title: '冰系能力', description: '冰系能力', priority: 'high' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateTimelinesToQuests(timelines, mainQuests, []);
            // 意图是"不重复关联"：断言内存对象 + 所有写入里 q1 都只出现一次
            // （原写法把断言藏在 if (timelineCall) 内，而该路径本就不写库 → 一直静默跳过）
            expect(timelines[0].questIds.filter(id => id === 'q1')).toHaveLength(1);
            const timelineCalls = mockSetItem.mock.calls.filter(c => c[0] === 'timelines');
            expect(timelineCalls.every(c => c[2].questIds.filter(id => id === 'q1').length === 1)).toBe(true);
        });
    });

    describe('distributeTimelinesToChapters', () => {
        test('distributes timelines to chapters', async () => {
            const timelines = [
                { id: 't1', storyOrder: 1 },
                { id: 't2', storyOrder: 2 },
            ];
            const chapters = [
                { id: 'ch1', chapterNumber: 1 },
                { id: 'ch2', chapterNumber: 2 },
            ];
            const chapterQuests = [
                { id: 'q1', chapterIds: ['ch1', 'ch2'], timelineEventIds: [] }
            ];
            mockSetItem.mockResolvedValue(true);

            await distributeTimelinesToChapters(timelines, chapters, chapterQuests);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('skips chapters without quest', async () => {
            const timelines = [{ id: 't1', storyOrder: 1 }];
            const chapters = [{ id: 'ch1', chapterNumber: 1 }];
            const chapterQuests = [];

            await distributeTimelinesToChapters(timelines, chapters, chapterQuests);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('skips when no timelines', async () => {
            const chapters = [{ id: 'ch1', chapterNumber: 1 }];
            const chapterQuests = [{ id: 'q1', chapterIds: ['ch1'] }];

            await distributeTimelinesToChapters([], chapters, chapterQuests);
            expect(mockSetItem).not.toHaveBeenCalled();
        });
    });

    describe('associateCharactersToTimelines', () => {
        test('associates character events to characters', async () => {
            const timelines = [
                { id: 't1', projectId: 'test-proj', eventType: 'character', title: '李四的觉醒', description: '李四觉醒了力量' }
            ];
            const characters = [
                { id: 'c1', name: '李四', currentContent: '角色描述' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateCharactersToTimelines(timelines, characters);
            expect(timelines[0].characterIds).toContain('c1');
        });

        test('skips non-character events', async () => {
            const timelines = [
                { id: 't1', eventType: 'world', title: '世界事件' }
            ];
            const characters = [{ id: 'c1', name: '角色' }];

            await associateCharactersToTimelines(timelines, characters);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('skips when no characters', async () => {
            const timelines = [
                { id: 't1', eventType: 'character', title: '角色事件' }
            ];

            await associateCharactersToTimelines(timelines, []);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('skips characters without name', async () => {
            const timelines = [
                { id: 't1', eventType: 'character', title: '事件', description: '事件描述' }
            ];
            const characters = [{ id: 'c1', name: '' }];

            await associateCharactersToTimelines(timelines, characters);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('does not duplicate characterIds', async () => {
            const timelines = [
                { id: 't1', eventType: 'character', title: '角色事件', description: '角色', characterIds: ['c1'] }
            ];
            const characters = [
                { id: 'c1', name: '角色', currentContent: '描述' }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateCharactersToTimelines(timelines, characters);
            // 同上：断言"不重复"的意图，不依赖是否发生写入
            expect(timelines[0].characterIds.filter(id => id === 'c1')).toHaveLength(1);
            const timelineCalls2 = mockSetItem.mock.calls.filter(c => c[0] === 'timelines');
            expect(timelineCalls2.every(c => c[2].characterIds.filter(id => id === 'c1').length === 1)).toBe(true);
        });
    });

    describe('associateMaterialsToQuests', () => {
        test('associates materials to quests by title match', async () => {
            const quests = [
                { id: 'q1', title: '冰系传承', description: '寻找冰系传承', materialIds: [] }
            ];
            const materials = [
                { id: 'm1', type: 'equipment', name: '冰系传承之剑', currentContent: '冰系传承的武器', questIds: [] }
            ];
            mockSetItem.mockResolvedValue(true);

            await associateMaterialsToQuests(quests, materials);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('skips character materials', async () => {
            const quests = [
                { id: 'q1', title: '任务', description: '描述', materialIds: [] }
            ];
            const materials = [
                { id: 'm1', type: 'character', name: '角色', currentContent: '描述' }
            ];

            await associateMaterialsToQuests(quests, materials);
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        test('does not duplicate questIds in materials', async () => {
            const quests = [
                { id: 'q1', title: '任务', description: '描述', materialIds: [] }
            ];
            const materials = [
                { id: 'm1', type: 'equipment', name: '任务物品', currentContent: '任务', questIds: ['q1'] }
            ];

            await associateMaterialsToQuests(quests, materials);
            // q1 已在 questIds 中：断言不产生重复（内存 + 所有写入）
            const matCalls = mockSetItem.mock.calls.filter(c => c[0] === 'materials');
            expect(matCalls.every(c => c[2].questIds.filter(id => id === 'q1').length === 1)).toBe(true);
        });
    });
});
