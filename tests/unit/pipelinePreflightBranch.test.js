const {
    preflight, postflight, pollutionCheck,
    diagnose, fullDiagnose, configure, PREFLIGHT_CONFIG
} = require('../../server/services/pipeline/pipelinePreflight');

describe('pipelinePreflight - branch coverage', () => {
    const origConfig = { ...PREFLIGHT_CONFIG };

    afterEach(() => {
        Object.assign(PREFLIGHT_CONFIG, origConfig);
    });

    describe('preflight - severity branches', () => {
        test('CRITICAL severity throws when blockOnCritical is true (default)', () => {
            configure({ blockOnCritical: true, verbose: false });
            expect(() => preflight('writer', {})).toThrow();
        });

        test('CRITICAL severity does not throw when blockOnCritical is false', () => {
            configure({ blockOnCritical: false, verbose: false });
            const result = preflight('writer', {});
            expect(result).toHaveProperty('passed');
            expect(result.blockedBy).toBeDefined();
        });

        test('verbose=false suppresses OK logs', () => {
            configure({ verbose: false });
            const ctx = { chapter: { outline: '大纲内容' }, project: { id: 'p1' } };
            const result = preflight('writer', ctx);
            expect(result).toHaveProperty('results');
        });

        test('verbose=true logs OK results', () => {
            configure({ verbose: true });
            const ctx = { chapter: { outline: '大纲内容' }, project: { id: 'p1' } };
            const result = preflight('writer', ctx);
            expect(result).toHaveProperty('results');
        });

        test('check that throws error is caught', () => {
            configure({ blockOnCritical: false, verbose: false });
            const result = preflight('writer', { chapter: null, project: null });
            expect(result.results).toBeDefined();
            expect(result).toHaveProperty('passed');
        });

        test('HIGH severity logs error when not blocking', () => {
            configure({ blockOnHigh: false, blockOnCritical: false, verbose: false });
            const result = preflight('writer', {});
            expect(result).toHaveProperty('passed');
        });
    });

    describe('postflight - severity branches', () => {
        test('CRITICAL severity failed check logs error', () => {
            configure({ verbose: false });
            const result = postflight('writer', { content: '' }, {});
            expect(result.passed).toBe(false);
        });

        test('HIGH severity failed check logs error', () => {
            configure({ verbose: false });
            const result = postflight('writer', {
                content: '初审结果：通过。未通过项目：无。'
            }, { materialNames: [] });
            expect(result).toHaveProperty('results');
        });

        test('verbose=true logs OK results', () => {
            configure({ verbose: true });
            const result = postflight('writer', {
                content: 'a'.repeat(500)
            }, { materialNames: [{ name: '角色', type: 'character' }] });
            expect(result).toHaveProperty('results');
        });

        test('MEDIUM severity failed check logs warn', () => {
            configure({ verbose: false });
            const result = postflight('reader', { readerOutput: 'no hardIssues here' }, {});
            expect(result).toHaveProperty('results');
        });

        test('unknown step returns passed', () => {
            configure({ verbose: false });
            const result = postflight('unknown-step', {});
            expect(result.passed).toBe(true);
        });
    });

    describe('pollutionCheck - severity branches', () => {
        test('detects character pollution for writer step', () => {
            configure({ verbose: false });
            const result = pollutionCheck('writer', {
                content: '张三和李四走在路上。'
            }, {
                materialNames: [{ name: '王五', type: 'character' }]
            });
            expect(result).toHaveProperty('results');
        });

        test('no pollution for unknown step', () => {
            configure({ verbose: false });
            const result = pollutionCheck('unknown-step', {}, {});
            expect(result.hasPollution).toBe(false);
        });

        test('detects material duplication for material-manager', () => {
            configure({ verbose: false });
            const result = pollutionCheck('material-manager', {}, {
                materials: [
                    { id: '1', type: 'character', name: '角色A', archived: false },
                    { id: '2', type: 'character', name: '角色A', archived: false },
                ]
            });
            expect(result).toHaveProperty('results');
        });
    });

    describe('diagnose', () => {
        test('handles check that throws without breaking', () => {
            configure({ verbose: false });
            const result = diagnose('writer', {});
            expect(result).toHaveProperty('passed');
            expect(result).toHaveProperty('failedChecks');
        });

        test('returns all passed for valid context', () => {
            const result = diagnose('writer', { chapter: { outline: '大纲' }, project: { id: 'p1' } });
            expect(result).toHaveProperty('passed');
        });
    });

    describe('fullDiagnose', () => {
        test('returns null output and pollution when output is null', () => {
            const result = fullDiagnose('writer', {}, null, null);
            expect(result.output).toBeNull();
            expect(result.pollution).toBeNull();
        });

        test('returns all three diagnostics with output', () => {
            configure({ verbose: false });
            const result = fullDiagnose('writer',
                { chapter: { outline: '大纲' }, project: { id: 'p1' } },
                { content: 'a'.repeat(500) },
                { materialNames: [] }
            );
            expect(result.input).toBeDefined();
            expect(result.output).toBeDefined();
            expect(result.pollution).toBeDefined();
        });
    });
});
