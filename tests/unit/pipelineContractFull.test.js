/**
 * pipelineContractFull.test.js
 * 深度覆盖 pipelineContract.js 分支
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true),
    queryItems: jest.fn().mockResolvedValue([])
}));

const store = require('../../server/store');
const pipelineContract = require('../../server/services/pipeline/pipelineContract');

describe('pipelineContract - getStepContract', () => {
    test('returns contract for outline-generator', () => {
        const c = pipelineContract.getStepContract('outline-generator');
        expect(c.length).toBeGreaterThan(0);
        expect(c[0].checks.length).toBeGreaterThan(0);
    });

    test('returns contract for writer', () => {
        const c = pipelineContract.getStepContract('writer');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for first-review', () => {
        const c = pipelineContract.getStepContract('first-review');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for second-review', () => {
        const c = pipelineContract.getStepContract('second-review');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for final-editor', () => {
        const c = pipelineContract.getStepContract('final-editor');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for polisher', () => {
        const c = pipelineContract.getStepContract('polisher');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for material-manager', () => {
        const c = pipelineContract.getStepContract('material-manager');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns contract for consistency-constraint', () => {
        const c = pipelineContract.getStepContract('consistency-constraint');
        expect(c.length).toBeGreaterThan(0);
    });

    test('returns empty for unknown step', () => {
        expect(pipelineContract.getStepContract('nonexistent')).toEqual([]);
    });
});

describe('pipelineContract - enforceContract', () => {
    test('passes for valid writer output', async () => {
        const result = await pipelineContract.enforceContract('proj1', 'writer', {
            content: '正文内容', wordCount: 2000
        });
        expect(result.passed).toBe(true);
    });

    test('throws ContractViolationError for invalid output', async () => {
        const { ContractViolationError } = require('../../server/shared/errors');
        await expect(pipelineContract.enforceContract('proj1', 'writer', { content: 'only content' }))
            .rejects.toBeInstanceOf(ContractViolationError);
    });
});

describe('pipelineContract - checkDataFlowIntegrity', () => {
    test('returns result for matching steps', async () => {
        const result = await pipelineContract.checkDataFlowIntegrity('proj1', 'writer', 'first-review');
        expect(result).toHaveProperty('valid');
        expect(Array.isArray(result.warnings)).toBe(true);
    });

    test('returns valid for unknown steps', async () => {
        const result = await pipelineContract.checkDataFlowIntegrity('proj1', 'unknown1', 'unknown2');
        expect(result.valid).toBe(true);
    });
});

describe('pipelineContract - validatePipelineState', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns valid for healthy chapters', async () => {
        store.queryItems.mockResolvedValue([
            { chapterNumber: 1, status: 'approved', outline: '大纲', content: '正文', wordCount: 2000 }
        ]);
        const result = await pipelineContract.validatePipelineState('proj1');
        expect(result.valid).toBe(true);
        expect(result.issues.length).toBe(0);
    });

    test('detects missing outline', async () => {
        store.queryItems.mockResolvedValue([
            { chapterNumber: 1, status: 'outlined', content: '正文', wordCount: 2000 }
        ]);
        const result = await pipelineContract.validatePipelineState('proj1');
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]).toContain('missing outline');
    });

    test('detects content without wordCount', async () => {
        store.queryItems.mockResolvedValue([
            { chapterNumber: 1, status: 'written', outline: '大纲', content: '正文' }
        ]);
        const result = await pipelineContract.validatePipelineState('proj1');
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]).toContain('wordCount');
    });

    test('skips terminal status chapters', async () => {
        store.queryItems.mockResolvedValue([
            { chapterNumber: 1, status: 'approved' }
        ]);
        const result = await pipelineContract.validatePipelineState('proj1');
        expect(result.valid).toBe(true);
    });

    test('skips chapter 0 without outline', async () => {
        store.queryItems.mockResolvedValue([
            { chapterNumber: 0, status: 'outlined' }
        ]);
        const result = await pipelineContract.validatePipelineState('proj1');
        expect(result.issues).not.toContain(expect.stringContaining('missing outline'));
    });
});

describe('pipelineContract - getNextStep', () => {
    test('returns next step for known step', () => {
        const next = pipelineContract.getNextStep('writer');
        expect(next).toBeDefined();
    });
});

describe('pipelineContract - isReviewStep', () => {
    test('first-review is review step', () => {
        expect(pipelineContract.isReviewStep('first-review')).toBe(true);
    });
    test('second-review is review step', () => {
        expect(pipelineContract.isReviewStep('second-review')).toBe(true);
    });
    test('writer is not review step', () => {
        expect(pipelineContract.isReviewStep('writer')).toBe(false);
    });
});
