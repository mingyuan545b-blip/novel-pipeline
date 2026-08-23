const { OUTPUT_CONTRACTS } = require('../../server/services/pipeline/outputContractDefs');

describe('outputContractDefs', () => {
    describe('writer contracts', () => {
        const writerContract = OUTPUT_CONTRACTS['writer'];
        test('has required fields', () => {
            expect(writerContract.requiredFields).toContain('content');
        });
        test('WO-001 passes with valid content', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-001');
            expect(check.check({ content: 'a'.repeat(500) })).toBe(true);
        });
        test('WO-001 fails with short content', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-001');
            expect(check.check({ content: 'short' })).toBe(false);
        });
        test('WO-001 fails with missing content', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-001');
            expect(check.check({})).toBeFalsy();
        });
        test('WO-002 passes with normal content', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-002');
            expect(check.check({ content: '正常的小说内容' })).toBe(true);
        });
        test('WO-002 fails with review report format', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-002');
            expect(check.check({ content: '初审结果：通过 未通过' })).toBe(false);
        });
        test('WO-003 passes when no materialNames', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-003');
            expect(check.check({ content: '内容' }, {})).toBe(true);
        });
        test('WO-003 passes when character name is in content', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-003');
            expect(check.check({ content: '张三走进了房间' }, { materialNames: [{ name: '张三', type: 'character' }] })).toBe(true);
        });
        test('WO-003 fails when character name is missing', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-003');
            expect(check.check({ content: '他走进了房间' }, { materialNames: [{ name: '张三', type: 'character' }] })).toBe(false);
        });
        test('WO-004 passes with sufficient word count', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-004');
            expect(check.check({ content: 'a'.repeat(500) }, { rejectMin: 200 })).toBe(true);
        });
        test('WO-004 fails with insufficient word count', () => {
            const check = writerContract.checks.find(c => c.code === 'WO-004');
            expect(check.check({ content: '短' }, { rejectMin: 200 })).toBe(false);
        });
    });

    describe('first-review contracts', () => {
        const contract = OUTPUT_CONTRACTS['first-review'];
        test('has required fields', () => {
            expect(contract.requiredFields).toContain('firstReviewOutput');
        });
        test('RO-001 passes with passed field', () => {
            const check = contract.checks[0];
            expect(check.check({ firstReviewOutput: '{"passed": true}' })).toBe(true);
        });
        test('RO-001 passes with 通过 keyword', () => {
            const check = contract.checks[0];
            expect(check.check({ firstReviewOutput: '审核通过' })).toBe(true);
        });
        test('RO-001 fails without review indicators', () => {
            const check = contract.checks[0];
            expect(check.check({ firstReviewOutput: '普通文本' })).toBe(false);
        });
    });

    describe('second-review contracts', () => {
        const contract = OUTPUT_CONTRACTS['second-review'];
        test('has required fields', () => {
            expect(contract.requiredFields).toContain('secondReviewOutput');
        });
        test('RO-003 passes with passed field', () => {
            const check = contract.checks[0];
            expect(check.check({ secondReviewOutput: '{"passed": true}' })).toBe(true);
        });
    });

    describe('final-editor contracts', () => {
        const contract = OUTPUT_CONTRACTS['final-editor'];
        test('FEO-001 passes with approved field', () => {
            const check = contract.checks[0];
            expect(check.check({ finalEditorOutput: '{"approved": true}' })).toBe(true);
        });
        test('FEO-001 passes with ✅', () => {
            const check = contract.checks[0];
            expect(check.check({ finalEditorOutput: '✅ 定稿通过' })).toBe(true);
        });
        test('FEO-001 fails without approval indicator', () => {
            const check = contract.checks[0];
            expect(check.check({ finalEditorOutput: '普通文本' })).toBe(false);
        });
    });

    describe('reviser contracts', () => {
        const contract = OUTPUT_CONTRACTS['reviser'];
        test('RVO-001 passes when origWc is 0', () => {
            const check = contract.checks.find(c => c.code === 'RVO-001');
            expect(check.check({ content: '短' }, { originalWordCount: 0 })).toBe(true);
        });
        test('RVO-001 passes when new content is long enough', () => {
            const check = contract.checks.find(c => c.code === 'RVO-001');
            expect(check.check({ content: 'a'.repeat(600) }, { originalWordCount: 1000 })).toBe(true);
        });
        test('RVO-001 fails when new content is too short', () => {
            const check = contract.checks.find(c => c.code === 'RVO-001');
            expect(check.check({ content: '短' }, { originalWordCount: 1000 })).toBe(false);
        });
        test('RVO-002 passes when no materialNames', () => {
            const check = contract.checks.find(c => c.code === 'RVO-002');
            expect(check.check({ content: '内容' }, {})).toBe(true);
        });
    });

    describe('polisher contracts', () => {
        const contract = OUTPUT_CONTRACTS['polisher'];
        test('PO-001 passes when origWc is 0', () => {
            const check = contract.checks[0];
            expect(check.check({ polisherOutput: '内容' }, { originalWordCount: 0 })).toBe(true);
        });
        test('PO-001 passes when polished content is long enough', () => {
            const check = contract.checks[0];
            expect(check.check({ polisherOutput: 'a'.repeat(900) }, { originalWordCount: 1000 })).toBe(true);
        });
    });

    describe('reader contracts', () => {
        const contract = OUTPUT_CONTRACTS['reader'];
        test('RDO-001 passes with hardIssues field', () => {
            const check = contract.checks[0];
            expect(check.check({ readerOutput: '{"hardIssues": []}' })).toBe(true);
        });
        test('RDO-001 passes with hard_issues field', () => {
            const check = contract.checks[0];
            expect(check.check({ readerOutput: 'hard_issues found' })).toBe(true);
        });
    });

    describe('material-manager contracts', () => {
        const contract = OUTPUT_CONTRACTS['material-manager'];
        test('MO-001 passes with material updates', () => {
            const check = contract.checks[0];
            expect(check.check({ materialUpdates: [{ action: 'create' }] })).toBe(true);
        });
        test('MO-001 fails without material updates', () => {
            const check = contract.checks[0];
            expect(check.check({ materialUpdates: [] })).toBe(false);
        });
    });

    describe('material-registrar contracts', () => {
        const contract = OUTPUT_CONTRACTS['material-registrar'];
        test('MRO-001 passes when noPlan is true', () => {
            const check = contract.checks[0];
            expect(check.check({ noPlan: true })).toBe(true);
        });
        test('MRO-001 passes with operations', () => {
            const check = contract.checks[0];
            expect(check.check({ operations: [{ type: 'register' }] })).toBe(true);
        });
        test('MRO-001 fails without operations and no noPlan', () => {
            const check = contract.checks[0];
            expect(check.check({ operations: [] })).toBe(false);
        });
    });

    describe('material-organizer contracts', () => {
        const contract = OUTPUT_CONTRACTS['material-organizer'];
        test('has no checks', () => {
            expect(contract.checks).toEqual([]);
            expect(contract.requiredFields).toEqual([]);
        });
    });
});
