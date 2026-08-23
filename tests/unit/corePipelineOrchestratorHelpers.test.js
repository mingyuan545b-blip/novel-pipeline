/**
 * orchestratorHelpers 单元测试
 * 覆盖：checkStopped, getSteps, clearDownstreamOutputs, generateOverrideOutput, persistPipelineLog
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));

jest.mock('../../server/services/pipeline/infinitePipeline', () => ({
    getInfinitePipelineStatus: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const store = require('../../server/store');
const { getInfinitePipelineStatus } = require('../../server/services/pipeline/infinitePipeline');
const {
    MAX_PIPELINE_LOG_ENTRIES,
    checkStopped,
    getSteps,
    clearDownstreamOutputs,
    generateOverrideOutput,
    persistPipelineLog
} = require('../../server/core/pipeline/orchestratorHelpers');

describe('orchestratorHelpers', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('常量', () => {
        test('MAX_PIPELINE_LOG_ENTRIES = 200', () => {
            expect(MAX_PIPELINE_LOG_ENTRIES).toBe(200);
        });
    });

    describe('checkStopped', () => {
        test('state 不存在时返回 false', () => {
            getInfinitePipelineStatus.mockReturnValue(null);
            expect(checkStopped('proj-1', 1)).toBe(false);
        });

        test('state.running=false 时返回 false', () => {
            getInfinitePipelineStatus.mockReturnValue({ running: false });
            expect(checkStopped('proj-1', 1)).toBe(false);
        });

        test('state.running=true 且 stopped=true 时返回 true 并 abort', () => {
            const controller = { signal: { aborted: false }, abort: jest.fn() };
            getInfinitePipelineStatus.mockReturnValue({ running: true, stopped: true });
            expect(checkStopped('proj-1', 1, controller)).toBe(true);
            expect(controller.abort).toHaveBeenCalled();
        });

        test('已 aborted 的 controller 不再 abort', () => {
            const controller = { signal: { aborted: true }, abort: jest.fn() };
            getInfinitePipelineStatus.mockReturnValue({ running: true, stopped: true });
            expect(checkStopped('proj-1', 1, controller)).toBe(true);
            expect(controller.abort).not.toHaveBeenCalled();
        });

        test('异常时返回 false 不抛出', () => {
            getInfinitePipelineStatus.mockImplementation(() => { throw new Error('boom'); });
            expect(checkStopped('proj-1', 1)).toBe(false);
        });
    });

    describe('getSteps', () => {
        test('skipSecondReview=true 返回 3 步流程', () => {
            const steps = getSteps({ flow: { skipSecondReview: true } });
            expect(steps).toEqual(['writer', 'fast-review', 'final-editor']);
        });

        test('skipSecondReview=false 返回 4 步流程', () => {
            const steps = getSteps({ flow: { skipSecondReview: false } });
            expect(steps).toEqual(['writer', 'first-review', 'second-review', 'final-editor']);
        });

        test('flow 缺失时返回 4 步流程', () => {
            const steps = getSteps({});
            expect(steps).toEqual(['writer', 'first-review', 'second-review', 'final-editor']);
        });
    });

    describe('clearDownstreamOutputs', () => {
        test('未知 failedStep 直接返回', async () => {
            await clearDownstreamOutputs('ch-1', 'unknown-step');
            expect(store.getItem).not.toHaveBeenCalled();
        });

        test('chapter 不存在时返回', async () => {
            store.getItem.mockResolvedValue(null);
            await clearDownstreamOutputs('ch-1', 'writer');
            expect(store.setItem).not.toHaveBeenCalled();
        });

        test('writer 失败时清除所有下游字段', async () => {
            const ch = {
                firstReviewOutput: 'aa', secondReviewOutput: 'bb',
                finalEditorOutput: 'cc', reviserOutput: 'dd',
                materialManagerOutput: 'ee', polisherOutput: 'ff'
            };
            store.getItem.mockResolvedValue(ch);
            await clearDownstreamOutputs('ch-1', 'writer');
            expect(ch.firstReviewOutput).toBeUndefined();
            expect(ch.secondReviewOutput).toBeUndefined();
            expect(ch.finalEditorOutput).toBeUndefined();
            expect(ch.reviserOutput).toBeUndefined();
            expect(ch.materialManagerOutput).toBeUndefined();
            expect(ch.polisherOutput).toBeUndefined();
            expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ updatedAt: expect.any(String) }));
        });

        test('字段值为空时不触发 setItem', async () => {
            store.getItem.mockResolvedValue({ firstReviewOutput: '' });
            await clearDownstreamOutputs('ch-1', 'writer');
            expect(store.setItem).not.toHaveBeenCalled();
        });

        test('final-editor 失败时只清除 material-manager 和 polisher', async () => {
            const ch = { materialManagerOutput: 'mm', polisherOutput: 'pp', firstReviewOutput: 'keep' };
            store.getItem.mockResolvedValue(ch);
            await clearDownstreamOutputs('ch-1', 'final-editor');
            expect(ch.materialManagerOutput).toBeUndefined();
            expect(ch.polisherOutput).toBeUndefined();
            expect(ch.firstReviewOutput).toBe('keep');
        });
    });

    describe('generateOverrideOutput', () => {
        test('包含覆盖原因和原审核摘要', () => {
            const out = generateOverrideOutput('测试原因', '初审', { summary: '原始摘要', issues: ['issue1'] });
            expect(out).toContain('测试原因');
            expect(out).toContain('原始摘要');
            expect(out).toContain('初审');
            expect(out).toContain('_overridden');
            expect(out).toContain('_overrideReason');
        });

        test('originalFeedback 缺失时使用默认值', () => {
            const out = generateOverrideOutput('R', '复审', null);
            expect(out).toContain('R');
            expect(out).toContain('无原审核摘要');
        });

        test('issues 元素为 string 时直接使用', () => {
            const out = generateOverrideOutput('R', '初审', { issues: ['字数不够'] });
            expect(out).toContain('字数不够');
        });

        test('issues 元素为对象时取 desc 字段', () => {
            const out = generateOverrideOutput('R', '初审', { issues: [{ desc: 'desc-field' }] });
            expect(out).toContain('desc-field');
        });

        test('issues 元素为对象时取 description 字段', () => {
            const out = generateOverrideOutput('R', '初审', { issues: [{ description: 'description-field' }] });
            expect(out).toContain('description-field');
        });

        test('issues 元素为对象无 desc/description 时 JSON 序列化', () => {
            const out = generateOverrideOutput('R', '初审', { issues: [{ foo: 'bar' }] });
            expect(out).toContain('"foo"');
        });

        test('issues 超过 3 个时只取前 3 个', () => {
            const issues = [{ desc: 'i1' }, { desc: 'i2' }, { desc: 'i3' }, { desc: 'i4' }];
            const out = generateOverrideOutput('R', '初审', { issues });
            expect(out).toContain('i1');
            expect(out).toContain('i3');
            expect(out).not.toContain('i4');
        });
    });

    describe('persistPipelineLog', () => {
        test('正常保存日志条目', async () => {
            const log = [{ step: 'writer', status: 'ok' }];
            await persistPipelineLog('ch-1', 'proj-1', log);
            expect(store.setItem).toHaveBeenCalledWith(
                'pipeline-logs',
                'ch-1_pipeline',
                expect.objectContaining({
                    id: 'ch-1_pipeline',
                    chapterId: 'ch-1',
                    projectId: 'proj-1',
                    entries: expect.arrayContaining([expect.objectContaining({ step: 'writer', timestamp: expect.any(String) })]),
                    updatedAt: expect.any(String)
                })
            );
        });

        test('日志超过 MAX_PIPELINE_LOG_ENTRIES 时裁剪到 150 条', async () => {
            const big = Array.from({ length: 250 }, (_, i) => ({ step: 's' + i }));
            await persistPipelineLog('ch-1', 'proj-1', big);
            const call = store.setItem.mock.calls[0];
            expect(call[2].entries.length).toBe(150);
            expect(call[2].entries[149].step).toBe('s249');
        });

        test('store.setItem 异常时不抛出', async () => {
            store.setItem.mockRejectedValue(new Error('store failed'));
            await expect(persistPipelineLog('ch-1', 'proj-1', [])).resolves.toBeUndefined();
        });

        test('已有 timestamp 的条目保留原值', async () => {
            const log = [{ step: 'writer', timestamp: 'fixed-ts' }];
            await persistPipelineLog('ch-1', 'proj-1', log);
            expect(store.setItem.mock.calls[0][2].entries[0].timestamp).toBe('fixed-ts');
        });
    });
});
