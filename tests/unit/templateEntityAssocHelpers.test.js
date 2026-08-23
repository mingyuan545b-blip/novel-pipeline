const {
    extractKeywords, associateTimelinesToQuests,
    distributeTimelinesToChapters, associateCharactersToTimelines,
    associateMaterialsToQuests
} = require('../../server/services/pipeline/outlineTemplateExpander/templateEntityAssocHelpers');

jest.mock('../../server/store', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../server/services/timelineAdapter', () => ({
    saveTimelineEvent: jest.fn(() => Promise.resolve({ id: 'mock-event' }))
}));

const PROJECT_ID = 'test-proj';

describe('templateEntityAssocHelpers', () => {
    describe('extractKeywords', () => {
        test('returns empty for null input', () => {
            expect(extractKeywords(null)).toEqual([]);
        });
        test('returns empty for empty string', () => {
            expect(extractKeywords('')).toEqual([]);
        });
        test('extracts keywords of length >= 2', () => {
            const result = extractKeywords('主角张三进入幽冥界');
            expect(result.length).toBeGreaterThan(0);
            expect(result.every(w => w.length >= 2)).toBe(true);
        });
        test('removes numbers and special chars', () => {
            const result = extractKeywords('第1章 张三（主角）');
            expect(result).not.toContain('第1章');
            expect(result).not.toContain('（');
        });
    });

    describe('associateTimelinesToQuests', () => {
        test('associates timeline events to quests by keyword match', async () => {
            const timelines = [{ id: 't1', projectId: PROJECT_ID, title: '幽冥界探索', description: '进入幽冥界探索' }];
            const mainQuests = [{ id: 'q1', title: '幽冥界探索', description: '进入幽冥界', priority: 'critical' }];
            const allQuests = [{ id: 'q1', title: '幽冥界探索', description: '进入幽冥界', priority: 'critical' }];
            await associateTimelinesToQuests(timelines, mainQuests, allQuests);
            expect(timelines[0].questIds).toBeDefined();
            if (timelines[0].questIds) {
                expect(timelines[0].questIds).toContain('q1');
            }
        });
        test('does not associate when score < 2', async () => {
            const timelines = [{ id: 't1', title: '无关事件', description: '无关描述' }];
            const mainQuests = [{ id: 'q1', title: '幽冥界任务', description: '探索幽冥界', priority: 'low' }];
            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(timelines[0].questIds).toBeUndefined();
        });
        test('boosts score for conflict+critical', async () => {
            const timelines = [{ id: 't1', projectId: PROJECT_ID, title: '幽冥界', description: '冲突', eventType: 'conflict' }];
            const mainQuests = [{ id: 'q1', title: '幽冥界', description: '', priority: 'critical' }];
            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(timelines[0].questIds).toContain('q1');
        });
        test('boosts score for resolution+critical', async () => {
            const timelines = [{ id: 't1', projectId: PROJECT_ID, title: '幽冥界', description: '解决', eventType: 'resolution' }];
            const mainQuests = [{ id: 'q1', title: '幽冥界', description: '', priority: 'critical' }];
            await associateTimelinesToQuests(timelines, mainQuests, []);
            expect(timelines[0].questIds).toContain('q1');
        });
    });

    describe('distributeTimelinesToChapters', () => {
        test('distributes timelines to chapters by quest', async () => {
            const timelines = [
                { id: 't1', projectId: PROJECT_ID, storyOrder: 1, title: '事件1' },
                { id: 't2', projectId: PROJECT_ID, storyOrder: 2, title: '事件2' },
            ];
            const chapters = [
                { id: 'ch1', chapterNumber: 1 },
                { id: 'ch2', chapterNumber: 2 },
            ];
            const chapterQuests = [
                { id: 'q1', chapterIds: ['ch1'], timelineEventIds: [] },
                { id: 'q2', chapterIds: ['ch2'], timelineEventIds: [] },
            ];
            await distributeTimelinesToChapters(timelines, chapters, chapterQuests);
            expect(chapterQuests[0].timelineEventIds.length).toBeGreaterThan(0);
        });
        test('skips chapters without quests', async () => {
            const timelines = [{ id: 't1', storyOrder: 1 }];
            const chapters = [{ id: 'ch1', chapterNumber: 1 }];
            const chapterQuests = [];
            await distributeTimelinesToChapters(timelines, chapters, chapterQuests);
        });
        test('skips when no timelines', async () => {
            const chapters = [{ id: 'ch1', chapterNumber: 1 }];
            const chapterQuests = [{ id: 'q1', chapterIds: ['ch1'] }];
            await distributeTimelinesToChapters([], chapters, chapterQuests);
        });
    });

    describe('associateCharactersToTimelines', () => {
        test('associates character events to characters by name', async () => {
            const timelines = [{ id: 't1', projectId: PROJECT_ID, eventType: 'character', title: '张三觉醒', description: '' }];
            const characters = [{ id: 'c1', name: '张三', currentContent: '主角' }];
            await associateCharactersToTimelines(timelines, characters);
            expect(timelines[0].characterIds).toContain('c1');
        });
        test('skips non-character events', async () => {
            const timelines = [{ id: 't1', eventType: 'world', title: '世界事件' }];
            const characters = [{ id: 'c1', name: '张三' }];
            await associateCharactersToTimelines(timelines, characters);
            expect(timelines[0].characterIds).toBeUndefined();
        });
        test('skips when no characters', async () => {
            const timelines = [{ id: 't1', eventType: 'character', title: '张三觉醒' }];
            await associateCharactersToTimelines(timelines, []);
        });
        test('does not associate when score < 2', async () => {
            const timelines = [{ id: 't1', eventType: 'character', title: '无关事件', description: '' }];
            const characters = [{ id: 'c1', name: '李四', currentContent: '配角' }];
            await associateCharactersToTimelines(timelines, characters);
            expect(timelines[0].characterIds).toBeUndefined();
        });
    });

    describe('associateMaterialsToQuests', () => {
        test('associates non-character materials to quests', async () => {
            const quests = [{ id: 'q1', title: '幽冥界', description: '探索', materialIds: [] }];
            const materials = [{ id: 'm1', type: 'equipment', name: '幽冥界宝剑', currentContent: '幽冥界探索必备' }];
            await associateMaterialsToQuests(quests, materials);
            expect(quests[0].materialIds).toContain('m1');
        });
        test('skips character materials', async () => {
            const quests = [{ id: 'q1', title: '幽冥界', description: '探索', materialIds: [] }];
            const materials = [{ id: 'm1', type: 'character', name: '张三', currentContent: '主角' }];
            await associateMaterialsToQuests(quests, materials);
            expect(quests[0].materialIds).toEqual([]);
        });
        test('skips when no matching materials', async () => {
            const quests = [{ id: 'q1', title: '幽冥界', description: '探索', materialIds: [] }];
            const materials = [{ id: 'm1', type: 'equipment', name: '无关物品', currentContent: '无关内容' }];
            await associateMaterialsToQuests(quests, materials);
            expect(quests[0].materialIds).toEqual([]);
        });
    });
});
