const {
    resolve, render, renderForStyleProfile,
    buildCreationStandards, CREATION_STANDARDS_TEMPLATE
} = require('../../server/config/promptFragments');

describe('promptFragments', () => {
    describe('resolve', () => {
        test('returns defaults for null genreId', () => {
            const result = resolve(null);
            expect(result.PROTAGONIST_WORD_COUNT).toBe(400);
            expect(result.SUPPORTING_WORD_COUNT).toBe(250);
            expect(result.NPC_WORD_COUNT).toBe(80);
        });
        test('returns defaults for unknown genreId', () => {
            const result = resolve('nonexistent');
            expect(result.PROTAGONIST_WORD_COUNT).toBe(400);
        });
        test('returns genre-specific values for known genreId', () => {
            const result = resolve('high-martial-comedy');
            expect(result.PROTAGONIST_TAGS).toBeDefined();
            expect(result.WORLDVIEW_RULE).toBeDefined();
            expect(result.POWER_SYSTEM_RULE).toBeDefined();
        });
        test('IS_DEPTH_PROFILE is boolean', () => {
            const result = resolve('high-martial-comedy');
            expect(typeof result.IS_DEPTH_PROFILE).toBe('boolean');
        });
        test('SUPPORTING_TRACKING_FIELDS is array', () => {
            const result = resolve('high-martial-comedy');
            expect(Array.isArray(result.SUPPORTING_TRACKING_FIELDS)).toBe(true);
        });
    });

    describe('render', () => {
        test('replaces template variables', () => {
            const template = '主角需要{{PROTAGONIST_WORD_COUNT}}字';
            const result = render(template, 'high-martial-comedy');
            expect(result).toContain('600');
            expect(result).not.toContain('{{PROTAGONIST_WORD_COUNT}}');
        });
        test('leaves unknown variables as-is', () => {
            const template = '未知变量{{UNKNOWN_VAR}}';
            const result = render(template, 'high-martial-comedy');
            expect(result).toContain('{{UNKNOWN_VAR}}');
        });
    });

    describe('renderForStyleProfile', () => {
        test('renders with null styleProfile', () => {
            const template = '主角需要{{PROTAGONIST_WORD_COUNT}}字';
            const result = renderForStyleProfile(template, null);
            expect(result).toContain('400');
        });
        test('renders with empty styleProfile', () => {
            const template = '主角需要{{PROTAGONIST_WORD_COUNT}}字';
            const result = renderForStyleProfile(template, {});
            expect(result).toContain('400');
        });
    });

    describe('buildCreationStandards', () => {
        test('builds standards with default genre', () => {
            const result = buildCreationStandards(null);
            expect(result).toContain('400');
            expect(result).toContain('素材创作标准');
        });
        test('builds standards with known genre', () => {
            const result = buildCreationStandards('high-martial-comedy');
            expect(result).toContain('素材创作标准');
        });
    });

    describe('CREATION_STANDARDS_TEMPLATE', () => {
        test('contains expected placeholders', () => {
            expect(CREATION_STANDARDS_TEMPLATE).toContain('{{PROTAGONIST_TAGS}}');
            expect(CREATION_STANDARDS_TEMPLATE).toContain('{{SUPPORTING_TAGS}}');
            expect(CREATION_STANDARDS_TEMPLATE).toContain('{{NPC_TAGS}}');
        });
    });
});
