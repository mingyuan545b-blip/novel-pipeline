const { REMEDIATION_TARGETS } = require('../../server/services/remediationTargets');

describe('remediationTargets', () => {
    test('exports REMEDIATION_TARGETS as object', () => {
        expect(typeof REMEDIATION_TARGETS).toBe('object');
    });

    test('each target has required fields', () => {
        for (const [key, target] of Object.entries(REMEDIATION_TARGETS)) {
            expect(target.label).toBeDefined();
            expect(target.targets).toBeDefined();
            expect(Array.isArray(target.targets)).toBe(true);
            expect(target.description).toBeDefined();
        }
    });

    test('has core targets', () => {
        expect(REMEDIATION_TARGETS['opening-hook']).toBeDefined();
        expect(REMEDIATION_TARGETS['chapter-hook']).toBeDefined();
        expect(REMEDIATION_TARGETS['cool-points']).toBeDefined();
        expect(REMEDIATION_TARGETS['character-voice']).toBeDefined();
    });

    test('targets reference valid target types', () => {
        const validTargets = ['writer-prompt', 'review-prompt', 'constraint', 'material', 'style-guidance', 'content-utils', 'first-chapter-rule'];
        for (const [key, target] of Object.entries(REMEDIATION_TARGETS)) {
            for (const t of target.targets) {
                expect(validTargets).toContain(t);
            }
        }
    });
});
