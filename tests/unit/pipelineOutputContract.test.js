const { validateOutput, getOutputContractSummary, OUTPUT_CONTRACTS } = require('../../server/services/pipeline/pipelineOutputContract');

describe('pipelineOutputContract', () => {
    describe('OUTPUT_CONTRACTS', () => {
        test('has contracts for all pipeline steps', () => {
            expect(OUTPUT_CONTRACTS['writer']).toBeDefined();
            expect(OUTPUT_CONTRACTS['first-review']).toBeDefined();
            expect(OUTPUT_CONTRACTS['second-review']).toBeDefined();
            expect(OUTPUT_CONTRACTS['final-editor']).toBeDefined();
            expect(OUTPUT_CONTRACTS['polisher']).toBeDefined();
            expect(OUTPUT_CONTRACTS['material-manager']).toBeDefined();
        });

        test('each contract has requiredFields and checks', () => {
            for (const [step, contract] of Object.entries(OUTPUT_CONTRACTS)) {
                expect(Array.isArray(contract.requiredFields)).toBe(true);
                expect(Array.isArray(contract.checks)).toBe(true);
            }
        });
    });

    describe('validateOutput', () => {
        test('returns passed for unknown step', () => {
            const result = validateOutput('unknown-step', { foo: 'bar' });
            expect(result.passed).toBe(true);
        });

        test('validates writer output - valid', () => {
            const result = validateOutput('writer', {
                content: 'A'.repeat(2000)
            }, { materialNames: [] });
            expect(result.passed).toBe(true);
        });

        test('validates writer output - missing content', () => {
            const result = validateOutput('writer', {});
            expect(result.passed).toBe(false);
            expect(result.failedChecks.some(r => r.code === 'OUT-FIELD-content')).toBe(true);
        });

        test('validates writer output - content too short', () => {
            const result = validateOutput('writer', { content: 'short' }, { rejectMin: 1500 });
            expect(result.passed).toBe(false);
            expect(result.failedChecks.some(r => r.code === 'WO-004')).toBe(true);
        });

        test('validates writer output - review format pollution', () => {
            const result = validateOutput('writer', { content: '初审结果：通过\n问题列表：无' + 'A'.repeat(2000) });
            expect(result.failedChecks.some(r => r.code === 'WO-002')).toBe(true);
        });

        test('validates first-review output', () => {
            const result = validateOutput('first-review', {
                firstReviewOutput: '{"passed": true, "issues": []}'
            });
            expect(result.passed).toBe(true);
        });

        test('validates first-review - missing output', () => {
            const result = validateOutput('first-review', {});
            expect(result.passed).toBe(false);
        });

        test('validates final-editor output', () => {
            const result = validateOutput('final-editor', {
                finalEditorOutput: '{"approved": true}'
            });
            expect(result.passed).toBe(true);
        });

        test('validates polisher output', () => {
            const result = validateOutput('polisher', {
                polisherOutput: '润色后正文'
            }, { originalWordCount: 5 });
            expect(result.passed).toBe(true);
        });

        test('validates material-manager output', () => {
            const result = validateOutput('material-manager', {
                materialUpdates: [{ action: 'update', name: '角色A' }]
            });
            expect(result.passed).toBe(true);
        });

        test('check exception is caught', () => {
            // A check that throws should be treated as failed
            const result = validateOutput('writer', { content: 'A'.repeat(2000) }, {
                materialNames: [{ type: 'character', name: '角色' }]
            });
            // WO-003 should check for character names
            expect(result.results.some(r => r.code === 'WO-003')).toBe(true);
        });

        test('validates fast-review output - valid', () => {
            const result = validateOutput('fast-review', {
                firstReviewOutput: 'A'.repeat(60)
            });
            expect(result.passed).toBe(true);
        });

        test('validates fast-review output - too short', () => {
            const result = validateOutput('fast-review', {
                firstReviewOutput: 'short'
            });
            expect(result.failedChecks.some(r => r.code === 'RO-001')).toBe(true);
        });

        test('validates second-review output - valid', () => {
            const result = validateOutput('second-review', {
                secondReviewOutput: '{"passed": true}'
            });
            expect(result.passed).toBe(true);
        });

        test('validates second-review - missing output', () => {
            const result = validateOutput('second-review', {});
            expect(result.passed).toBe(false);
            expect(result.failedChecks.some(r => r.code === 'OUT-FIELD-secondReviewOutput')).toBe(true);
        });

        test('validates reviser output - valid with originalWordCount', () => {
            const result = validateOutput('reviser', {
                content: 'A'.repeat(800)
            }, { originalWordCount: 1000, materialNames: [] });
            expect(result.passed).toBe(true);
        });

        test('validates reviser output - content too short', () => {
            const result = validateOutput('reviser', {
                content: 'A'.repeat(400)
            }, { originalWordCount: 1000 });
            expect(result.failedChecks.some(r => r.code === 'RVO-001')).toBe(true);
        });

        test('validates reviser output - originalWordCount=0 时跳过长度检查', () => {
            const result = validateOutput('reviser', {
                content: 'short'
            }, { originalWordCount: 0 });
            expect(result.failedChecks.some(r => r.code === 'RVO-001')).toBe(false);
        });

        test('validates reader output - valid with hardIssues', () => {
            const result = validateOutput('reader', {
                readerOutput: '{"hardIssues": []}'
            });
            expect(result.passed).toBe(true);
        });

        test('validates reader output - missing hardIssues', () => {
            const result = validateOutput('reader', {
                readerOutput: '{"someField": "value"}'
            });
            expect(result.failedChecks.some(r => r.code === 'RDO-001')).toBe(true);
        });

        test('validates material-registrar output - valid with operations', () => {
            const result = validateOutput('material-registrar', {
                operations: [{ type: 'update' }]
            });
            expect(result.passed).toBe(true);
        });

        test('validates material-registrar output - noPlan 时跳过', () => {
            const result = validateOutput('material-registrar', {
                noPlan: true, operations: []
            });
            expect(result.passed).toBe(true);
        });

        test('validates material-registrar output - 无 operations 失败', () => {
            const result = validateOutput('material-registrar', {
                operations: []
            });
            expect(result.failedChecks.some(r => r.code === 'MRO-001')).toBe(true);
        });

        test('validates material-organizer output - 空契约总是通过', () => {
            const result = validateOutput('material-organizer', {});
            expect(result.passed).toBe(true);
            expect(result.results).toHaveLength(0);
        });

        test('validates writer output - 含素材角色名时通过 WO-003', () => {
            const result = validateOutput('writer', {
                content: '主角登场' + 'A'.repeat(2000)
            }, { materialNames: [{ type: 'character', name: '主角' }] });
            expect(result.results.find(r => r.code === 'WO-003').passed).toBe(true);
        });

        test('validates writer output - 不含素材角色名时 WO-003 失败', () => {
            const result = validateOutput('writer', {
                content: 'A'.repeat(2000)
            }, { materialNames: [{ type: 'character', name: '主角' }] });
            expect(result.results.find(r => r.code === 'WO-003').passed).toBe(false);
        });

        test('validates writer output - 无 character 素材时 WO-003 跳过', () => {
            const result = validateOutput('writer', {
                content: 'A'.repeat(2000)
            }, { materialNames: [{ type: 'worldview', name: '世界观' }] });
            expect(result.results.find(r => r.code === 'WO-003').passed).toBe(true);
        });
    });

    describe('getOutputContractSummary', () => {
        test('returns summary for all steps', () => {
            const summary = getOutputContractSummary();
            expect(Object.keys(summary).length).toBeGreaterThan(0);
        });

        test('summary has requiredFields and checks', () => {
            const summary = getOutputContractSummary();
            for (const [step, info] of Object.entries(summary)) {
                expect(Array.isArray(info.requiredFields)).toBe(true);
                expect(Array.isArray(info.checks)).toBe(true);
                for (const check of info.checks) {
                    expect(check.code).toBeDefined();
                    expect(check.label).toBeDefined();
                    expect(check.severity).toBeDefined();
                }
            }
        });
    });
});
