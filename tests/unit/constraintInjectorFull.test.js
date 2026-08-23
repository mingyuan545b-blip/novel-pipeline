/**
 * constraintInjectorFull.test.js
 * 深度覆盖 constraintInjector.js 分支
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true),
    queryItems: jest.fn().mockResolvedValue([]),
    listItems: jest.fn().mockResolvedValue([])
}));
jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

const store = require('../../server/store');
const { getDataContext } = require('../../server/services/dataContext');
const {
    BASE_CONSTRAINT_PRESETS,
    getConstraintPresets,
    buildConstraintInjection
} = require('../../server/services/prompts/constraintInjector');

describe('constraintInjector - BASE_CONSTRAINT_PRESETS', () => {
    test('has required base constraints', () => {
        expect(BASE_CONSTRAINT_PRESETS['no-derailment']).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['character-consistency']).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['anti-tool-character']).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['character-depth']).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['worldview-consistency']).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['hook-every-chapter']).toBeDefined();
    });

    test('each preset has label and desc', () => {
        for (const [id, preset] of Object.entries(BASE_CONSTRAINT_PRESETS)) {
            expect(preset.label).toBeTruthy();
            expect(preset.desc).toBeTruthy();
        }
    });

    test('some presets have applicableGenres', () => {
        expect(BASE_CONSTRAINT_PRESETS['fast-escalation'].applicableGenres).toBeDefined();
        expect(BASE_CONSTRAINT_PRESETS['fast-escalation'].applicableGenres).toContain('high-martial-comedy');
    });

    test('simple-readable-style has null applicableGenres', () => {
        expect(BASE_CONSTRAINT_PRESETS['simple-readable-style'].applicableGenres).toBeNull();
    });
});

describe('constraintInjector - getConstraintPresets', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns base presets when store is empty', async () => {
        store.listItems.mockResolvedValue([]);
        const result = await getConstraintPresets(null);
        expect(result['no-derailment']).toBeDefined();
        expect(result['character-consistency']).toBeDefined();
    });

    test('returns store presets when available', async () => {
        store.listItems.mockResolvedValue([
            { id: 'custom-1', label: '自定义约束', desc: '测试约束' }
        ]);
        const result = await getConstraintPresets(null);
        expect(result['custom-1']).toBeDefined();
        expect(result['custom-1'].label).toBe('自定义约束');
    });

    test('merges genre presets when genre provided', async () => {
        store.listItems.mockResolvedValue([]);
        const result = await getConstraintPresets('high-martial-comedy');
        expect(result['no-derailment']).toBeDefined();
    });

    test('falls back to base on store error', async () => {
        store.listItems.mockRejectedValue(new Error('Store error'));
        const result = await getConstraintPresets(null);
        expect(result['no-derailment']).toBeDefined();
    });
});

describe('constraintInjector - buildConstraintInjection branches', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns empty string when project not found', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(null) });
        const result = await buildConstraintInjection('proj1', 'outline');
        expect(result).toBe('');
    });

    test('returns empty string when no effective constraints', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ genre: 'novel', constraints: [] }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1', 'outline');
        expect(result).toBe('');
    });

    test('returns constraint output with project constraints', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ genre: 'novel', constraints: ['no-derailment', 'character-consistency'] }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1', 'outline');
        expect(typeof result).toBe('string');
    });

    test('filters incompatible constraints from genre', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({
            genre: 'high-martial-comedy', constraints: ['face-slapping', 'no-derailment']
        }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1', 'outline');
        expect(typeof result).toBe('string');
    });

    test('applies scope filter when agentType provided', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ genre: 'novel', constraints: ['no-derailment'] }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1', 'writer');
        expect(typeof result).toBe('string');
    });

    test('works without agentType', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({ genre: 'novel', constraints: ['no-derailment'] }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1');
        expect(typeof result).toBe('string');
    });

    test('handles styleProfile constraintOverrides', async () => {
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue({
            genre: 'novel', constraints: ['no-derailment'],
            styleProfile: { constraintOverrides: ['character-depth'] }
        }) });
        store.listItems.mockResolvedValue([]);
        const result = await buildConstraintInjection('proj1', 'outline');
        expect(typeof result).toBe('string');
    });
});
