/**
 * StepResult 单元测试
 * 覆盖：构造校验、默认值、静态工厂方法、字数不足专用构造
 */
const { StepResult } = require('../../server/core/pipeline/steps/StepResult');

describe('StepResult', () => {
    describe('constructor', () => {
        test('缺少 step 时抛错', () => {
            expect(() => new StepResult({ passed: true })).toThrow('step is required');
        });

        test('passed 非 boolean 时抛错', () => {
            expect(() => new StepResult({ step: 'writer', passed: 1 })).toThrow('passed must be boolean');
        });

        test('未提供 result/feedback/materialGuidance/chapter 时使用默认值', () => {
            const r = new StepResult({ step: 'writer', passed: true });
            expect(r.step).toBe('writer');
            expect(r.passed).toBe(true);
            expect(r.result).toEqual({ response: '' });
            expect(r.feedback).toEqual({
                summary: 'writer通过',
                issues: [],
                suggestions: []
            });
            expect(r.materialGuidance).toBe('');
            expect(r.chapter).toBeNull();
        });

        test('passed=false 时默认 summary 含"未通过"', () => {
            const r = new StepResult({ step: 'first-review', passed: false });
            expect(r.feedback.summary).toContain('未通过');
        });

        test('显式参数覆盖默认值', () => {
            const chapter = { id: 'ch-1', content: 'abc' };
            const r = new StepResult({
                step: 'final-editor',
                passed: true,
                result: { response: 'resp' },
                feedback: { summary: 'S', issues: [{ desc: 'i' }], suggestions: ['x'] },
                materialGuidance: 'mg',
                chapter
            });
            expect(r.result).toEqual({ response: 'resp' });
            expect(r.feedback.summary).toBe('S');
            expect(r.materialGuidance).toBe('mg');
            expect(r.chapter).toBe(chapter);
        });
    });

    describe('static pass()', () => {
        test('返回 passed=true 的实例', () => {
            const r = StepResult.pass('writer');
            expect(r.passed).toBe(true);
            expect(r.step).toBe('writer');
        });

        test('支持附加参数', () => {
            const r = StepResult.pass('writer', { materialGuidance: 'mg' });
            expect(r.materialGuidance).toBe('mg');
        });
    });

    describe('static fail()', () => {
        test('返回 passed=false 的实例', () => {
            const r = StepResult.fail('first-review');
            expect(r.passed).toBe(false);
            expect(r.step).toBe('first-review');
        });
    });

    describe('static wordCountFail()', () => {
        test('生成字数不足 feedback', () => {
            const r = StepResult.wordCountFail('writer', 1000, 2000);
            expect(r.passed).toBe(false);
            expect(r.step).toBe('writer');
            expect(r.feedback.summary).toContain('字数严重不足');
            expect(r.feedback.summary).toContain('1000');
            expect(r.feedback.summary).toContain('2000');
            expect(r.feedback.summary).toContain('差1000');
            expect(r.feedback.issues[0].severity).toBe('critical');
            expect(r.feedback.suggestions.length).toBeGreaterThan(0);
        });

        test('差值 = min - actual', () => {
            const r = StepResult.wordCountFail('writer', 1500, 1800);
            expect(r.feedback.summary).toContain('差300');
        });
    });
});
