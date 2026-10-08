/**
 * T1 验收：素材管理 L1 失败必须可判定，不得静默吞
 *
 * 验收标准（每条都是硬断言，不看日志）：
 *  A. 双策略失败 → ok=false + strategy=none + 有 error 文本
 *  B. 合法空 updates（模型正确回答"本章无变更"）→ ok=true（**不得**被误判失败）
 *  C. JSON 成功 → strategy=json，落库走 processUpdates
 *  D. JSON 失败 + markdown 可恢复 → ok=true + strategy=markdown（且不再走 processUpdates，避免重复落库）
 *  E. processUpdates 抛错 → 降级 markdown
 */
jest.mock('../../server/services/pipeline/steps/materialUpdateProcessor', () => ({
    processUpdates: jest.fn(),
}));
jest.mock('../../server/services/pipeline/steps/materialMarkdownExtractor', () => ({
    extractFromMarkdown: jest.fn(),
}));
jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { processUpdates } = require('../../server/services/pipeline/steps/materialUpdateProcessor');
const { extractFromMarkdown } = require('../../server/services/pipeline/steps/materialMarkdownExtractor');
const { applyUpdatesWithFallback, STRATEGY, UNPARSABLE_CODE, buildUnparsableError } =
    require('../../server/services/pipeline/steps/materialUpdateApplier');

const base = () => ({
    response: '',
    chapter: { chapterNumber: 7, id: 'ch7' },
    projectId: 'p1',
    materials: [],
    styleProfile: {},
});

describe('T1 applyUpdatesWithFallback - 可判定性', () => {
    beforeEach(() => jest.clearAllMocks());

    test('A. 双策略失败 → ok=false / strategy=none / error 可读', async () => {
        const r = await applyUpdatesWithFallback({ ...base(), response: '模型今天心情不好，什么都没输出' });
        expect(r.ok).toBe(false);
        expect(r.strategy).toBe(STRATEGY.NONE);
        expect(r.updates).toEqual([]);
        expect(r.error).toContain('updates');
        expect(processUpdates).not.toHaveBeenCalled();
    });

    test('B. 合法空 updates → ok=true（回归：旧实现会抛 JSON extraction failed）', async () => {
        processUpdates.mockResolvedValue([]);
        const r = await applyUpdatesWithFallback({ ...base(), response: '{"updates":[]}' });
        expect(r.ok).toBe(true);
        expect(r.strategy).toBe(STRATEGY.JSON);
        expect(r.updates).toEqual([]);
        expect(processUpdates).toHaveBeenCalledWith([], expect.anything(), 'p1', [], {});
    });

    test('C. JSON 成功 → strategy=json 且落库', async () => {
        processUpdates.mockResolvedValue([{ action: 'create', type: 'equipment', name: '断刃' }]);
        const r = await applyUpdatesWithFallback({
            ...base(),
            response: '```json\n{"updates":[{"type":"equipment","name":"断刃","action":"create","content":"缺口短刀"}]}\n```',
        });
        expect(r.ok).toBe(true);
        expect(r.strategy).toBe(STRATEGY.JSON);
        expect(r.updates).toHaveLength(1);
        expect(extractFromMarkdown).not.toHaveBeenCalled();
    });

    test('D. JSON 失败 + markdown 恢复 → ok=true / strategy=markdown（不重复落库）', async () => {
        extractFromMarkdown.mockResolvedValue([{ action: 'update', type: 'character', name: '林婉' }]);
        const r = await applyUpdatesWithFallback({ ...base(), response: '## [character] 林婉 (v2)\n内容...' });
        expect(r.ok).toBe(true);
        expect(r.strategy).toBe(STRATEGY.MARKDOWN);
        expect(r.updates).toHaveLength(1);
        expect(processUpdates).not.toHaveBeenCalled();
    });

    test('D2. JSON 失败 + markdown 抽到 0 条 → 仍判失败（无证据=不算成功）', async () => {
        extractFromMarkdown.mockResolvedValue([]);
        const r = await applyUpdatesWithFallback({ ...base(), response: '随便一段没有结构的文本' });
        expect(r.ok).toBe(false);
        expect(r.strategy).toBe(STRATEGY.NONE);
        expect(r.error).toContain('markdown 未抽到');
    });

    test('E. processUpdates 抛错 → 降级 markdown（保留旧语义）', async () => {
        processUpdates.mockRejectedValue(new Error('store 挂了'));
        extractFromMarkdown.mockResolvedValue([{ action: 'create', type: 'location', name: '雾港' }]);
        const r = await applyUpdatesWithFallback({
            ...base(), response: '{"updates":[{"type":"location","name":"雾港","content":"大雾港口"}]}',
        });
        expect(r.ok).toBe(true);
        expect(r.strategy).toBe(STRATEGY.MARKDOWN);
    });

    test('F. 失败错误带独立 errorCode，便于日志检索与重试判定', () => {
        const err = buildUnparsableError('detail-x');
        expect(err.code).toBe(UNPARSABLE_CODE);
        expect(err.isMaterialOutputUnparsable).toBe(true);
        expect(err.message).toContain('detail-x');
    });
});
