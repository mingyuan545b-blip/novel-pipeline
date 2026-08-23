const { buildRemediationPrompt, parseRemediationResponse, executeRemediations } = require('../../server/services/remediationHelpers');

describe('remediationHelpers', () => {
    describe('buildRemediationPrompt', () => {
        test('builds prompt with project info', () => {
            const project = { name: '测试项目', genre: 'high-martial-comedy' };
            const genre = { label: '高武穿越' };
            const chapters = [{ chapterNumber: 1, content: 'A'.repeat(500) }];
            const sampleText = '样本文本';
            const reviewText = '角色行为不一致';

            const result = buildRemediationPrompt(project, genre, chapters, sampleText, reviewText);
            expect(result).toContain('测试项目');
            expect(result).toContain('high-martial-comedy');
            expect(result).toContain('高武穿越');
            expect(result).toContain('角色行为不一致');
        });

        test('includes JSON format instruction', () => {
            const result = buildRemediationPrompt({}, null, [], '', 'test');
            expect(result).toContain('problems');
            expect(result).toContain('remediations');
        });

        test('includes target type descriptions', () => {
            const result = buildRemediationPrompt({}, null, [], '', 'test');
            expect(result).toContain('writer-prompt');
            expect(result).toContain('review-prompt');
            expect(result).toContain('constraint');
        });
    });

    describe('parseRemediationResponse', () => {
        test('parses valid JSON response', () => {
            const response = JSON.stringify({
                problems: [{ id: 'p1', title: '问题1', severity: 'high', description: '描述' }],
                remediations: [{ problemId: 'p1', target: 'writer-prompt', action: '修改', content: '规则', priority: 'high' }]
            });
            const result = parseRemediationResponse(response, 'review');
            expect(result.problems.length).toBe(1);
            expect(result.remediations.length).toBe(1);
        });

        test('handles JSON embedded in text', () => {
            const response = '以下是分析结果：\n' + JSON.stringify({
                problems: [{ id: 'p1', title: '问题', severity: 'medium', description: 'd' }],
                remediations: []
            }) + '\n以上是结果。';
            const result = parseRemediationResponse(response, 'review');
            expect(result.problems.length).toBe(1);
        });

        test('falls back on invalid JSON', () => {
            const result = parseRemediationResponse('not json at all', '评测意见内容');
            expect(result.problems.length).toBe(1);
            expect(result.problems[0].id).toBe('p1');
            expect(result.remediations.length).toBe(1);
            expect(result.remediations[0].target).toBe('style-guidance');
        });

        test('fallback uses reviewText as content', () => {
            const result = parseRemediationResponse('invalid', '这是评测内容');
            expect(result.remediations[0].content).toBe('这是评测内容');
        });
    });

    describe('executeRemediations', () => {
        test('returns execution log with applied status', async () => {
            // Mock remediationApplier
            jest.resetModules();
            jest.doMock('../../server/services/remediationApplier', () => ({
                applyRemediation: jest.fn().mockResolvedValue({ ok: true })
            }));

            const { executeRemediations: exec } = require('../../server/services/remediationHelpers');
            const remediations = [
                { target: 'writer-prompt', action: 'add rule', content: '规则', priority: 'high' }
            ];
            const log = await exec('proj1', remediations, 'novel');
            expect(log.length).toBe(1);
            expect(log[0].status).toBe('applied');

            jest.dontMock('../../server/services/remediationApplier');
        });

        test('returns failed status on error', async () => {
            jest.resetModules();
            jest.doMock('../../server/services/remediationApplier', () => ({
                applyRemediation: jest.fn().mockRejectedValue(new Error('apply failed'))
            }));

            const { executeRemediations: exec } = require('../../server/services/remediationHelpers');
            const remediations = [
                { target: 'constraint', action: 'add', content: 'test', priority: 'medium' }
            ];
            const log = await exec('proj1', remediations, 'novel');
            expect(log.length).toBe(1);
            expect(log[0].status).toBe('failed');
            expect(log[0].detail).toBe('apply failed');

            jest.dontMock('../../server/services/remediationApplier');
        });
    });
});
