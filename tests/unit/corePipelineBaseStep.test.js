/**
 * BaseStep 单元测试
 * 覆盖：构造、execute 抽象、persist、classifyAndHandle、waitForRetry、getRetryConfig、resolveWordConfig、runWithRetry
 */
jest.mock('../../server/store', () => ({ setItem: jest.fn() }));
jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));
jest.mock('../../server/config/systemConfig', () => ({
    LLM_DEFAULTS: {
        overloadedWaitMs: 5000,
        timeoutWaitMs: 3000,
        contextErrorCooldownMs: 10000,
        consecutiveOverloadThreshold: 3
    }
}));
jest.mock('../../server/config/genreDefaults', () => ({
    NOVEL_DEFAULTS: { maxChapterWords: 3000, rejectMinWords: 1500 }
}));

const store = require('../../server/store');
const { BaseStep } = require('../../server/core/pipeline/steps/BaseStep');
const { StepResult } = require('../../server/core/pipeline/steps/StepResult');

class TestStep extends BaseStep {
    constructor(behavior) {
        super('test-step');
        this.behavior = behavior || (() => StepResult.pass('test-step'));
    }
    async execute(params) { return this.behavior(params); }
}

describe('BaseStep', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('constructor', () => {
        test('缺少 name 抛错', () => {
            expect(() => new BaseStep()).toThrow('name is required');
        });
        test('保存 name', () => {
            expect(new BaseStep('writer').name).toBe('writer');
        });
    });

    describe('execute()', () => {
        test('基类 execute 抛出"must be implemented"', async () => {
            await expect(new BaseStep('x').execute({})).rejects.toThrow('must be implemented');
        });
    });

    describe('persist()', () => {
        test('chapter 为 null 时记录 warn 不保存', async () => {
            await new BaseStep('x').persist(null);
            expect(store.setItem).not.toHaveBeenCalled();
        });
        test('chapter 缺少 id 时记录 error 不保存', async () => {
            await new BaseStep('x').persist({ content: 'c' });
            expect(store.setItem).not.toHaveBeenCalled();
        });
        test('chapterId 覆盖 chapter.id', async () => {
            await new BaseStep('x').persist({ content: 'c' }, 'override-id');
            expect(store.setItem).toHaveBeenCalledWith('chapters', 'override-id', expect.objectContaining({ updatedAt: expect.any(String) }));
        });
        test('正常持久化时设置 updatedAt', async () => {
            const ch = { id: 'ch-1', content: 'c' };
            await new BaseStep('x').persist(ch);
            expect(ch.updatedAt).toBeDefined();
            expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', ch);
        });
    });

    describe('classifyAndHandle()', () => {
        test('overloaded 错误时 shouldRetry=true + overloadedWaitMs', () => {
            const step = new BaseStep('writer');
            const result = step.classifyAndHandle(new Error('529 overload'));
            expect(result.isOverloaded).toBe(true);
            expect(result.shouldRetry).toBe(true);
            expect(result.waitMs).toBe(5000);
        });
        test('timeout 错误时 shouldRetry=true + timeoutWaitMs', () => {
            const step = new BaseStep('writer');
            const result = step.classifyAndHandle(new Error('ETIMEDOUT'));
            expect(result.isTimeout).toBe(true);
            expect(result.shouldRetry).toBe(true);
            expect(result.waitMs).toBe(3000);
        });
        test('context 错误时 shouldRetry=false + contextErrorCooldownMs', () => {
            const step = new BaseStep('writer');
            const result = step.classifyAndHandle(new Error('CONTEXT_OVERFLOW'));
            expect(result.isContextErr).toBe(true);
            expect(result.shouldRetry).toBe(false);
            expect(result.waitMs).toBe(10000);
        });
        test('未知错误时 shouldRetry=false + waitMs=0', () => {
            const step = new BaseStep('writer');
            const result = step.classifyAndHandle(new Error('something else'));
            expect(result.shouldRetry).toBe(false);
            expect(result.waitMs).toBe(0);
        });
    });

    describe('waitForRetry()', () => {
        test('waitMs=0 时不等待', async () => {
            const start = Date.now();
            await new BaseStep('x').waitForRetry(0);
            expect(Date.now() - start).toBeLessThan(50);
        });
        test('waitMs>0 时等待指定时间', async () => {
            const start = Date.now();
            await new BaseStep('x').waitForRetry(50);
            expect(Date.now() - start).toBeGreaterThanOrEqual(40);
        });
    });

    describe('getRetryConfig()', () => {
        test('返回 LLM_DEFAULTS 中的配置', () => {
            const cfg = new BaseStep('x').getRetryConfig();
            expect(cfg).toEqual({
                maxRetries: 3,
                overloadedWaitMs: 5000,
                timeoutWaitMs: 3000
            });
        });
    });

    describe('resolveWordConfig()', () => {
        test('优先使用 project.wordConfig', () => {
            const cfg = new BaseStep('x').resolveWordConfig(
                { wordConfig: { maxWords: 5000, rejectMin: 2500 } },
                { word: { maxChapter: 3000, rejectMin: 1500 } }
            );
            expect(cfg).toEqual({ maxChapterWords: 5000, rejectMinWords: 2500 });
        });
        test('project.wordConfig 缺失时用 modeConfig', () => {
            const cfg = new BaseStep('x').resolveWordConfig({}, { word: { maxChapter: 3000, rejectMin: 1500 } });
            expect(cfg).toEqual({ maxChapterWords: 3000, rejectMinWords: 1500 });
        });
        test('project 和 modeConfig 都缺失时用 NOVEL_DEFAULTS', () => {
            const cfg = new BaseStep('x').resolveWordConfig({}, {});
            expect(cfg).toEqual({ maxChapterWords: 3000, rejectMinWords: 1500 });
        });
        test('project=null 时不抛错', () => {
            const cfg = new BaseStep('x').resolveWordConfig(null, null);
            expect(cfg).toEqual({ maxChapterWords: 3000, rejectMinWords: 1500 });
        });
    });

    describe('runWithRetry()', () => {
        beforeAll(() => jest.useFakeTimers());
        afterAll(() => jest.useRealTimers());

        test('execute 成功且 result.chapter 存在时自动 persist', async () => {
            const chapter = { id: 'ch-1', content: 'c' };
            const step = new TestStep(() => StepResult.pass('test-step', { chapter }));
            const result = await step.runWithRetry({ chapterId: 'ch-1' });
            expect(result.passed).toBe(true);
            expect(store.setItem).toHaveBeenCalledWith('chapters', 'ch-1', expect.objectContaining({ id: 'ch-1' }));
        });

        test('execute 成功且 result.chapter 为 null 时记录 warn 不 persist', async () => {
            const step = new TestStep(() => StepResult.pass('test-step'));
            const result = await step.runWithRetry({ chapterId: 'ch-1' });
            expect(result.passed).toBe(true);
            expect(store.setItem).not.toHaveBeenCalled();
        });

        test('execute 抛错且不可重试时返回 StepResult.fail', async () => {
            const step = new TestStep(() => { throw new Error('something wrong'); });
            const result = await step.runWithRetry({});
            expect(result.passed).toBe(false);
            expect(result.feedback.summary).toContain('something wrong');
        });

        test('execute 抛错且可重试时重试到 maxAttempts', async () => {
            let count = 0;
            const step = new TestStep(() => {
                count++;
                throw new Error('529 overload');
            });
            const promise = step.runWithRetry({}, 2);
            await jest.runAllTimersAsync();
            const result = await promise;
            expect(count).toBe(2);
            expect(result.passed).toBe(false);
        });

        test('execute 第 N 次成功时返回成功结果', async () => {
            let count = 0;
            const step = new TestStep(() => {
                count++;
                if (count < 2) throw new Error('529 overload');
                return StepResult.pass('test-step');
            });
            const promise = step.runWithRetry({}, 3);
            await jest.runAllTimersAsync();
            const result = await promise;
            expect(count).toBe(2);
            expect(result.passed).toBe(true);
        });

        test('maxRetries 默认使用 getRetryConfig().maxRetries', async () => {
            let count = 0;
            const step = new TestStep(() => {
                count++;
                throw new Error('529');
            });
            const promise = step.runWithRetry({});
            await jest.runAllTimersAsync();
            await promise;
            expect(count).toBe(3);
        });

        test('显式 maxRetries=1 时不重试', async () => {
            let count = 0;
            const step = new TestStep(() => {
                count++;
                throw new Error('529');
            });
            await step.runWithRetry({}, 1);
            expect(count).toBe(1);
        });
    });
});
