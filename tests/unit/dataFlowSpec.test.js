const { getDataFlowSpec, getDataFlowGraph, DATA_FLOW_SPEC } = require('../../server/services/pipeline/dataFlowSpec');

describe('dataFlowSpec', () => {
    describe('DATA_FLOW_SPEC', () => {
        test('has entries for all pipeline steps', () => {
            expect(DATA_FLOW_SPEC['outline-generator']).toBeDefined();
            expect(DATA_FLOW_SPEC['writer']).toBeDefined();
            expect(DATA_FLOW_SPEC['first-review']).toBeDefined();
            expect(DATA_FLOW_SPEC['final-editor']).toBeDefined();
            expect(DATA_FLOW_SPEC['polisher']).toBeDefined();
            expect(DATA_FLOW_SPEC['material-manager']).toBeDefined();
        });

        test('each step has required fields', () => {
            for (const [step, spec] of Object.entries(DATA_FLOW_SPEC)) {
                expect(spec.label).toBeDefined();
                expect(spec.inputs).toBeDefined();
                expect(spec.outputs).toBeDefined();
                expect(spec.downstream).toBeDefined();
                expect(spec.pollutionRisk).toBeDefined();
                expect(spec.missingDataAction).toBeDefined();
            }
        });

        test('inputs have required properties', () => {
            for (const [step, spec] of Object.entries(DATA_FLOW_SPEC)) {
                for (const input of spec.inputs) {
                    expect(input.name).toBeDefined();
                    expect(input.source).toBeDefined();
                    expect(input.format).toBeDefined();
                }
            }
        });

        test('outputs have required properties', () => {
            for (const [step, spec] of Object.entries(DATA_FLOW_SPEC)) {
                for (const output of spec.outputs) {
                    expect(output.name).toBeDefined();
                    expect(output.format).toBeDefined();
                }
            }
        });
    });

    describe('getDataFlowSpec', () => {
        test('returns spec for known step', () => {
            const spec = getDataFlowSpec('writer');
            expect(spec).toBeDefined();
            expect(spec.label).toBeDefined();
        });

        test('returns null for unknown step', () => {
            expect(getDataFlowSpec('unknown')).toBeNull();
        });

        test('returns null for no argument', () => {
            expect(getDataFlowSpec()).toBeNull();
        });
    });

    describe('getDataFlowGraph', () => {
        test('returns graph with all steps', () => {
            const graph = getDataFlowGraph();
            expect(Object.keys(graph).length).toBeGreaterThan(0);
        });

        test('each graph entry has simplified structure', () => {
            const graph = getDataFlowGraph();
            for (const [step, entry] of Object.entries(graph)) {
                expect(entry.label).toBeDefined();
                expect(Array.isArray(entry.inputs)).toBe(true);
                expect(Array.isArray(entry.outputs)).toBe(true);
                expect(Array.isArray(entry.downstream)).toBe(true);
                expect(typeof entry.pollutionRisk).toBe('string');
                expect(typeof entry.missingDataAction).toBe('string');
            }
        });

        test('simplified inputs have name/source/from/required', () => {
            const graph = getDataFlowGraph();
            for (const [step, entry] of Object.entries(graph)) {
                for (const input of entry.inputs) {
                    expect(input.name).toBeDefined();
                    expect(input.source).toBeDefined();
                    expect(input.from).toBeDefined();
                    expect(input.required).toBeDefined();
                }
            }
        });
    });
});
