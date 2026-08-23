const { OUTPUT_CONTRACTS } = require('../../server/services/pipeline/outputContractDefs');

describe('outputContractDefs - branch coverage', () => {
    describe('writer checks', () => {
        const writerChecks = OUTPUT_CONTRACTS['writer'].checks;

        test('WO-001 passes with long content', () => {
            const check = writerChecks.find(c => c.code === 'WO-001');
            expect(check.check({ content: 'a'.repeat(500) })).toBe(true);
        });

        test('WO-001 fails with short content', () => {
            const check = writerChecks.find(c => c.code === 'WO-001');
            expect(check.check({ content: 'short' })).toBe(false);
        });

        test('WO-001 fails with empty content', () => {
            const check = writerChecks.find(c => c.code === 'WO-001');
            expect(check.check({ content: '' })).toBeFalsy();
        });

        test('WO-002 passes with normal content', () => {
            const check = writerChecks.find(c => c.code === 'WO-002');
            expect(check.check({ content: '正常小说内容'.repeat(50) })).toBe(true);
        });

        test('WO-002 fails with review format', () => {
            const check = writerChecks.find(c => c.code === 'WO-002');
            expect(check.check({ content: '初审结果：通过。未通过项目：无。' })).toBe(false);
        });

        test('WO-003 passes when no materialNames', () => {
            const check = writerChecks.find(c => c.code === 'WO-003');
            expect(check.check({ content: '内容' }, {})).toBe(true);
        });

        test('WO-003 passes when materialNames is empty', () => {
            const check = writerChecks.find(c => c.code === 'WO-003');
            expect(check.check({ content: '内容' }, { materialNames: [] })).toBe(true);
        });

        test('WO-003 passes when content includes character name', () => {
            const check = writerChecks.find(c => c.code === 'WO-003');
            expect(check.check(
                { content: '李四走在路上' },
                { materialNames: [{ name: '李四', type: 'character' }] }
            )).toBe(true);
        });

        test('WO-003 fails when content missing character names', () => {
            const check = writerChecks.find(c => c.code === 'WO-003');
            expect(check.check(
                { content: '路人走在路上' },
                { materialNames: [{ name: '李四', type: 'character' }] }
            )).toBe(false);
        });

        test('WO-003 passes when no character materials', () => {
            const check = writerChecks.find(c => c.code === 'WO-003');
            expect(check.check(
                { content: '内容' },
                { materialNames: [{ name: '宝剑', type: 'equipment' }] }
            )).toBe(true);
        });

        test('WO-004 passes with enough words', () => {
            const check = writerChecks.find(c => c.code === 'WO-004');
            expect(check.check(
                { content: 'a'.repeat(500) },
                { rejectMin: 100 }
            )).toBe(true);
        });

        test('WO-004 fails with too few words', () => {
            const check = writerChecks.find(c => c.code === 'WO-004');
            expect(check.check(
                { content: '短' },
                { rejectMin: 500 }
            )).toBe(false);
        });
    });

    describe('first-review checks', () => {
        const checks = OUTPUT_CONTRACTS['first-review'].checks;

        test('RO-001 passes with passed field', () => {
            const check = checks[0];
            expect(check.check({ firstReviewOutput: '{"passed": true}' })).toBe(true);
        });

        test('RO-001 passes with 通过 keyword', () => {
            const check = checks[0];
            expect(check.check({ firstReviewOutput: '审核通过' })).toBe(true);
        });

        test('RO-001 passes with 未通过 keyword', () => {
            const check = checks[0];
            expect(check.check({ firstReviewOutput: '审核未通过' })).toBe(true);
        });

        test('RO-001 fails without review indicators', () => {
            const check = checks[0];
            expect(check.check({ firstReviewOutput: '普通文本' })).toBe(false);
        });
    });

    describe('fast-review checks', () => {
        const checks = OUTPUT_CONTRACTS['fast-review'].checks;

        test('passes with long output', () => {
            expect(checks[0].check({ firstReviewOutput: 'a'.repeat(100) })).toBe(true);
        });

        test('fails with short output', () => {
            expect(checks[0].check({ firstReviewOutput: '短' })).toBe(false);
        });
    });

    describe('second-review checks', () => {
        const checks = OUTPUT_CONTRACTS['second-review'].checks;

        test('RO-003 passes with passed field', () => {
            expect(checks[0].check({ secondReviewOutput: '{"passed": true}' })).toBe(true);
        });

        test('RO-003 fails without review indicators', () => {
            expect(checks[0].check({ secondReviewOutput: '普通文本' })).toBe(false);
        });
    });

    describe('final-editor checks', () => {
        const checks = OUTPUT_CONTRACTS['final-editor'].checks;

        test('FEO-001 passes with approved field', () => {
            expect(checks[0].check({ finalEditorOutput: '{"approved": true}' })).toBe(true);
        });

        test('FEO-001 passes with 通过 keyword', () => {
            expect(checks[0].check({ finalEditorOutput: '审核通过' })).toBe(true);
        });

        test('FEO-001 passes with ✅', () => {
            expect(checks[0].check({ finalEditorOutput: '✅ 定稿通过' })).toBe(true);
        });

        test('FEO-001 fails without approval indicators', () => {
            expect(checks[0].check({ finalEditorOutput: '普通文本' })).toBe(false);
        });
    });

    describe('reviser checks', () => {
        const checks = OUTPUT_CONTRACTS['reviser'].checks;

        test('RVO-001 passes when origWc is 0', () => {
            const check = checks.find(c => c.code === 'RVO-001');
            expect(check.check({ content: '短' }, { originalWordCount: 0 })).toBe(true);
        });

        test('RVO-001 passes when new content >= 50% of original', () => {
            const check = checks.find(c => c.code === 'RVO-001');
            expect(check.check(
                { content: 'a'.repeat(600) },
                { originalWordCount: 1000 }
            )).toBe(true);
        });

        test('RVO-001 fails when new content < 50% of original', () => {
            const check = checks.find(c => c.code === 'RVO-001');
            expect(check.check(
                { content: '短' },
                { originalWordCount: 1000 }
            )).toBe(false);
        });

        test('RVO-002 passes when no materialNames', () => {
            const check = checks.find(c => c.code === 'RVO-002');
            expect(check.check({ content: '内容' }, {})).toBe(true);
        });

        test('RVO-002 passes when content includes character name', () => {
            const check = checks.find(c => c.code === 'RVO-002');
            expect(check.check(
                { content: '李四修改后' },
                { materialNames: [{ name: '李四', type: 'character' }] }
            )).toBe(true);
        });

        test('RVO-002 fails when content missing character names', () => {
            const check = checks.find(c => c.code === 'RVO-002');
            expect(check.check(
                { content: '修改后内容' },
                { materialNames: [{ name: '李四', type: 'character' }] }
            )).toBe(false);
        });
    });

    describe('polisher checks', () => {
        const checks = OUTPUT_CONTRACTS['polisher'].checks;

        test('PO-001 passes when origWc is 0', () => {
            expect(checks[0].check({ polisherOutput: '内容' }, { originalWordCount: 0 })).toBe(true);
        });

        test('PO-001 passes when polished content >= 80%', () => {
            expect(checks[0].check(
                { polisherOutput: 'a'.repeat(900) },
                { originalWordCount: 1000 }
            )).toBe(true);
        });

        test('PO-001 fails when polished content < 80%', () => {
            expect(checks[0].check(
                { polisherOutput: '短' },
                { originalWordCount: 1000 }
            )).toBe(false);
        });
    });

    describe('reader checks', () => {
        const checks = OUTPUT_CONTRACTS['reader'].checks;

        test('RDO-001 passes with hardIssues field', () => {
            expect(checks[0].check({ readerOutput: '{"hardIssues": []}' })).toBe(true);
        });

        test('RDO-001 passes with hard_issues field', () => {
            expect(checks[0].check({ readerOutput: 'hard_issues: none' })).toBe(true);
        });

        test('RDO-001 fails without hard issues', () => {
            expect(checks[0].check({ readerOutput: '普通阅读输出' })).toBe(false);
        });
    });

    describe('material-manager checks', () => {
        const checks = OUTPUT_CONTRACTS['material-manager'].checks;

        test('MO-001 passes with material updates', () => {
            expect(checks[0].check({ materialUpdates: [{ action: 'create' }] })).toBe(true);
        });

        test('MO-001 fails without material updates', () => {
            expect(checks[0].check({ materialUpdates: [] })).toBe(false);
        });
    });

    describe('material-registrar checks', () => {
        const checks = OUTPUT_CONTRACTS['material-registrar'].checks;

        test('MRO-001 passes with noPlan', () => {
            expect(checks[0].check({ noPlan: true })).toBe(true);
        });

        test('MRO-001 passes with operations', () => {
            expect(checks[0].check({ operations: [{ type: 'create' }] })).toBe(true);
        });

        test('MRO-001 fails without operations and no noPlan', () => {
            expect(checks[0].check({ operations: [] })).toBe(false);
        });
    });

    describe('material-organizer', () => {
        test('has empty checks', () => {
            expect(OUTPUT_CONTRACTS['material-organizer'].checks).toEqual([]);
            expect(OUTPUT_CONTRACTS['material-organizer'].requiredFields).toEqual([]);
        });
    });
});
