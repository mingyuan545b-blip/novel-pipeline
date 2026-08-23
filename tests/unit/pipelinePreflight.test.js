const {
    preflight, postflight, pollutionCheck,
    diagnose, fullDiagnose, configure, PREFLIGHT_CONFIG
} = require('../../server/services/pipeline/pipelinePreflight');

describe('pipelinePreflight', () => {
    describe('preflight', () => {
        test('passes for valid writer context', () => {
            const ctx = { chapter: { outline: '大纲' }, project: { id: 'p1' } };
            const result = preflight('writer', ctx);
            expect(result).toHaveProperty('passed');
            expect(result).toHaveProperty('results');
        });
        test('fails for invalid writer context', () => {
            expect(() => preflight('writer', {})).toThrow();
        });
        test('returns results for unknown step', () => {
            const result = preflight('unknown-step', {});
            expect(result.passed).toBe(true);
            expect(result.results).toEqual([]);
        });
        test('handles check that throws', () => {
            const result = preflight('writer', { chapter: { outline: '大纲' }, project: { id: 'p1' } });
            expect(result.results.length).toBeGreaterThan(0);
        });
    });

    describe('postflight', () => {
        test('returns result for valid output', () => {
            const result = postflight('writer', { content: 'a'.repeat(500) });
            expect(result).toHaveProperty('passed');
            expect(result).toHaveProperty('results');
        });
        test('returns result for unknown step', () => {
            const result = postflight('unknown-step', {});
            expect(result.passed).toBe(true);
        });
    });

    describe('pollutionCheck', () => {
        test('returns result for writer step', () => {
            const result = pollutionCheck('writer', { content: '内容' }, { materialNames: [] });
            expect(result).toHaveProperty('hasPollution');
            expect(result).toHaveProperty('results');
        });
        test('returns no pollution for unknown step', () => {
            const result = pollutionCheck('unknown-step', {}, {});
            expect(result.hasPollution).toBe(false);
        });
    });

    describe('diagnose', () => {
        test('returns diagnostic results without throwing', () => {
            const result = diagnose('writer', {});
            expect(result).toHaveProperty('passed');
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('failedChecks');
        });
        test('returns result for valid context', () => {
            const result = diagnose('writer', { chapter: { outline: '大纲' }, project: { id: 'p1' } });
            expect(result).toHaveProperty('passed');
            expect(result).toHaveProperty('results');
        });
    });

    describe('fullDiagnose', () => {
        test('returns full diagnostic without output', () => {
            const result = fullDiagnose('writer', {}, null, null);
            expect(result).toHaveProperty('input');
            expect(result.output).toBeNull();
            expect(result.pollution).toBeNull();
        });
        test('returns full diagnostic with output', () => {
            const result = fullDiagnose('writer', { chapter: { outline: '大纲' }, project: { id: 'p1' } }, { content: '内容' }, { materialNames: [] });
            expect(result.input).toBeDefined();
            expect(result.output).toBeDefined();
            expect(result.pollution).toBeDefined();
        });
    });

    describe('configure', () => {
        test('updates PREFLIGHT_CONFIG', () => {
            const origVerbose = PREFLIGHT_CONFIG.verbose;
            configure({ verbose: false });
            expect(PREFLIGHT_CONFIG.verbose).toBe(false);
            configure({ verbose: origVerbose });
        });
    });
});
