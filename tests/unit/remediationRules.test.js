const { isRuleRedundant, consolidateRules } = require('../../server/services/remediationRules');

describe('remediationRules', () => {
    describe('isRuleRedundant', () => {
        test('detects keyword overlap redundancy', () => {
            const existing = [{ rule: '章节完整性检查：确保所有悬空线索闭环' }];
            const newRule = '完整性要求：残缺章节必须补全闭环';
            expect(isRuleRedundant(existing, newRule)).toBe(true);
        });

        test('allows non-overlapping rules', () => {
            const existing = [{ rule: '开头必须有冲突或悬念' }];
            const newRule = '战斗场景必须有画面感';
            expect(isRuleRedundant(existing, newRule)).toBe(false);
        });

        test('detects conflict pair redundancy', () => {
            const existing = [{ rule: '使用生物信号传导描述异化' }];
            const newRule = '禁止使用技术术语，用幼崽视角锁定';
            expect(isRuleRedundant(existing, newRule)).toBe(true);
        });

        test('allows empty existing rules', () => {
            expect(isRuleRedundant([], 'any new rule')).toBe(false);
        });
    });

    describe('consolidateRules', () => {
        test('adds new rule when under max', () => {
            const existing = [{ rule: 'rule1', source: 'test', addedAt: new Date().toISOString() }];
            const result = consolidateRules(existing, 'rule2', 5);
            expect(result.length).toBe(2);
        });

        test('consolidates overlapping topic rules', () => {
            const existing = [
                { rule: '【章节完整性】确保闭环', source: 'test', addedAt: new Date().toISOString() },
                { rule: '【章节完整性】检查悬空', source: 'test', addedAt: new Date().toISOString() }
            ];
            const result = consolidateRules(existing, 'new rule', 5);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        test('respects maxRules limit', () => {
            const existing = Array.from({ length: 5 }, (_, i) => ({
                rule: `rule${i}`, source: 'test', addedAt: new Date().toISOString()
            }));
            const result = consolidateRules(existing, 'new rule', 5);
            expect(result.length).toBeLessThanOrEqual(5);
        });

        test('skips redundant rules', () => {
            const existing = [{ rule: '完整性检查：确保闭环', source: 'test', addedAt: new Date().toISOString() }];
            const result = consolidateRules(existing, '完整性要求：残缺闭环', 5);
            expect(result.length).toBe(1);
        });
    });
});
