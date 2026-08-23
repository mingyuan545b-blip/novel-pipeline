const { buildRemediationPrompt, parseRemediationResponse } = require('../../server/services/remediationHelpers');

describe('remediationHelpers', () => {
    describe('buildRemediationPrompt', () => {
        test('includes project info', () => {
            const project = { name: '测试小说', genre: '都市异能' };
            const prompt = buildRemediationPrompt(project, { label: '长篇' }, [], '', '评测文本');
            expect(prompt).toContain('测试小说');
            expect(prompt).toContain('都市异能');
        });

        test('includes review text', () => {
            const prompt = buildRemediationPrompt({ name: 'T', genre: 'G' }, null, [], '', '角色太扁平');
            expect(prompt).toContain('角色太扁平');
        });

        test('includes JSON format specification', () => {
            const prompt = buildRemediationPrompt({ name: 'T', genre: 'G' }, null, [], '', 'review');
            expect(prompt).toContain('problems');
            expect(prompt).toContain('remediations');
        });

        test('includes target type descriptions', () => {
            const prompt = buildRemediationPrompt({ name: 'T', genre: 'G' }, null, [], '', 'review');
            expect(prompt).toContain('writer-prompt');
            expect(prompt).toContain('constraint');
            expect(prompt).toContain('material');
        });

        test('shows no chapters message when empty', () => {
            const prompt = buildRemediationPrompt({ name: 'T', genre: 'G' }, null, [], '', 'review');
            expect(prompt).toContain('暂无章节');
        });
    });

    describe('parseRemediationResponse', () => {
        test('parses valid JSON response', () => {
            const response = JSON.stringify({
                problems: [{ id: 'p1', title: '问题1', severity: 'high', description: 'desc' }],
                remediations: [{ problemId: 'p1', target: 'style-guidance', action: '修复', content: '内容', priority: 'high' }]
            });
            const result = parseRemediationResponse(response, 'review');
            expect(result.problems.length).toBe(1);
            expect(result.remediations.length).toBe(1);
        });

        test('parses JSON embedded in text', () => {
            const response = '分析结果如下：\n{"problems":[{"id":"p1","title":"T","severity":"high","description":"D"}],"remediations":[]}\n完成';
            const result = parseRemediationResponse(response, 'review');
            expect(result.problems.length).toBe(1);
        });

        test('falls back on invalid JSON', () => {
            const result = parseRemediationResponse('not json', '评测文本内容');
            expect(result.problems.length).toBe(1);
            expect(result.remediations.length).toBe(1);
            expect(result.remediations[0].target).toBe('style-guidance');
        });
    });
});
