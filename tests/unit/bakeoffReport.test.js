/**
 * bakeoffReport 单测（双盲接入 modelBakeoff）
 */
const { buildReport, summarizeViolations } = require('../../server/services/bakeoffReport');

const results = [
    { model: 'modelX', elapsedMs: 1000, error: null, content: 'X文', usage: { prompt_tokens: 1, completion_tokens: 2 }, metrics: { chars: 10, metaConstraints: { M1: { violations: 2 }, M2: { violations: 0 } } } },
    { model: 'modelY', elapsedMs: 2000, error: 'boom', content: null, usage: {}, metrics: null },
];

describe('summarizeViolations', () => {
    test('累加命中；err/n-a', () => {
        expect(summarizeViolations(results[0].metrics)).toBe('2');
        expect(summarizeViolations(null)).toBe('n/a');
        expect(summarizeViolations({ metaConstraints: { error: 'x' } })).toBe('err');
    });
});

describe('buildReport', () => {
    test('非盲：表含模型名，报告保留原结果', () => {
        const r = buildReport(results);
        expect(r.tableLines.join('\n')).toContain('modelX');
        expect(r.report.blind).toBe(false);
        expect(r.report.results).toEqual(results);
        expect(r.mapping).toBeNull();
    });

    test('盲评：表中只有代号，不含模型名；报告去掉 model 字段', () => {
        const r = buildReport(results, { blind: true, seed: 's' });
        const text = r.tableLines.join('\n');
        expect(text).not.toContain('modelX');
        expect(text).not.toContain('modelY');
        for (const x of r.report.results) expect(x.model).toBeUndefined();
        expect(r.report.blind).toBe(true);
    });

    test('盲评映射：代号 → 模型名', () => {
        const r = buildReport(results, { blind: true, seed: 's' });
        expect(Object.values(r.mapping).sort()).toEqual(['modelX', 'modelY']);
    });

    test('空输入安全', () => {
        expect(buildReport(null).tableLines).toHaveLength(1);
    });
});
