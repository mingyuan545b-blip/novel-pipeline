/**
 * regressionPipelineOutputs.test.js — Pipeline输出回归测试
 * 覆盖问题：
 * 1. firstReviewOutput丢失 — clearRoundOutputs不应清除审核结果字段
 * 2. clearDownstreamOutputs字段映射正确性
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn(),
}));

const store = require('../../server/store');
const { clearRoundOutputs } = require('../../server/core/pipeline/orchestratorRoundHelpers');

describe('回归测试: Pipeline输出保留', () => {
    beforeEach(() => jest.clearAllMocks());

    test('clearRoundOutputs不应清除firstReviewOutput和secondReviewOutput', async () => {
        const chapter = {
            firstReviewOutput: '初审结果内容',
            secondReviewOutput: '复审结果内容',
            finalEditorOutput: '定稿输出',
            reviserOutput: '修改输出',
            materialManagerOutput: '素材管理输出',
            polisherOutput: '润色输出',
        };
        const chapterId = 'test-chapter-id';

        await clearRoundOutputs(chapter, chapterId, 2, 1);

        // 审核结果应保留
        expect(chapter.firstReviewOutput).toBe('初审结果内容');
        expect(chapter.secondReviewOutput).toBe('复审结果内容');
        // 下游输出应被清除
        expect(chapter.finalEditorOutput).toBeUndefined();
        expect(chapter.reviserOutput).toBeUndefined();
        expect(chapter.materialManagerOutput).toBeUndefined();
        expect(chapter.polisherOutput).toBeUndefined();
    });

    test('clearRoundOutputs在round=1且startRound=0时不应清除任何字段', async () => {
        const chapter = {
            firstReviewOutput: '初审结果',
            reviserOutput: '修改输出',
        };

        await clearRoundOutputs(chapter, 'test-id', 1, 0);

        expect(chapter.firstReviewOutput).toBe('初审结果');
        expect(chapter.reviserOutput).toBe('修改输出');
        expect(store.setItem).not.toHaveBeenCalled();
    });

    test('clearRoundOutputs清除字段时应保存updatedAt', async () => {
        const chapter = { reviserOutput: '修改输出' };
        const beforeTime = new Date().toISOString();

        await clearRoundOutputs(chapter, 'test-id', 2, 1);

        expect(chapter.updatedAt).toBeDefined();
        expect(chapter.updatedAt >= beforeTime).toBe(true);
    });

    test('clearRoundOutputs清除字段时应调用store.setItem', async () => {
        const chapter = { reviserOutput: '修改输出', firstReviewOutput: '保留' };

        await clearRoundOutputs(chapter, 'test-id', 2, 1);

        expect(store.setItem).toHaveBeenCalledWith('chapters', 'test-id', expect.objectContaining({
            firstReviewOutput: '保留',
        }));
        // reviserOutput被delete移除，不应在对象中
        const savedChapter = store.setItem.mock.calls[0][2];
        expect(savedChapter.reviserOutput).toBeUndefined();
    });
});
