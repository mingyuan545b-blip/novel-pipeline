const { isFoundationMaterial } = require('../server/db/jsonStore');
const { shouldOverrideReviewRejection } = require('../server/services/pipeline/reviewOverride');

describe('isFoundationMaterial', () => {
    test('returns false for null', async () => {
        expect(await isFoundationMaterial(null)).toBe(false);
    });

    test('returns true for worldview with no parentPlane', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w1' })).toBe(true);
    });

    test('returns true for power-system with no parentPlane', async () => {
        expect(await isFoundationMaterial({ type: 'power-system', id: 'ps1' })).toBe(true);
    });

    test('returns true for faction with parentPlane=null', async () => {
        expect(await isFoundationMaterial({ type: 'faction', id: 'f1', parentPlane: null })).toBe(true);
    });

    test('returns false for faction with parentPlane set', async () => {
        expect(await isFoundationMaterial({ type: 'faction', id: 'f2', parentPlane: 'sp1' })).toBe(false);
    });

    test('returns true for institution with parentPlane=null', async () => {
        expect(await isFoundationMaterial({ type: 'institution', id: 'i1', parentPlane: null })).toBe(true);
    });

    test('returns true when isFoundation=true overrides sourceChapter', async () => {
        expect(await isFoundationMaterial({ type: 'other', id: 'o1', isFoundation: true, sourceChapter: 5 })).toBe(true);
    });

    test('returns false when isFoundation=false overrides worldview', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w2', isFoundation: false, parentPlane: null })).toBe(false);
    });

    test('returns false for material with sourceChapter', async () => {
        expect(await isFoundationMaterial({ type: 'worldview', id: 'w3', sourceChapter: 5 })).toBe(false);
    });

    test('returns true for mechanism with no parentPlane', async () => {
        expect(await isFoundationMaterial({ type: 'mechanism', id: 'm1' })).toBe(true);
    });

    test('returns true for writing-technique with no parentPlane', async () => {
        expect(await isFoundationMaterial({ type: 'writing-technique', id: 'wt1' })).toBe(true);
    });

    test('returns true for index with no parentPlane', async () => {
        expect(await isFoundationMaterial({ type: 'index', id: 'idx1' })).toBe(true);
    });
});

describe('shouldOverrideReviewRejection', () => {
    test('overrides when word count hallucination detected', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足，低于最低要求', issues: [] }
        };
        const result = shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(true);
        expect(result.reason).toContain('幻觉');
    });

    test('does not override when word count is actually low', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '字数不足', issues: [] }
        };
        const result = shouldOverrideReviewRejection(stepResult, 'short', 1500, 2200, [], {});
        expect(result.override).toBe(false);
    });

    test('overrides dialect misjudgment', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '方言不规范', issues: [] }
        };
        const chapterContent = '俺跟你说，这事儿整得贼拉离谱';
        const result = shouldOverrideReviewRejection(stepResult, chapterContent, 3000, 2200, [], {});
        expect(result.override).toBe(true);
    });

    test('overrides style misjudgment', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '说话风格不当', issues: [] }
        };
        const materials = [{ type: 'character', speechStyle: 'abstract' }];
        const result = shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, materials, {});
        expect(result.override).toBe(true);
    });

    test('overrides humor misjudgment for comedy genre', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '幽默过度', issues: [] }
        };
        const project = { styleProfile: { genreLabel: '反套路喜剧' } };
        const result = shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], project);
        expect(result.override).toBe(true);
    });

    test('does not override for regular issues', () => {
        const stepResult = {
            passed: false,
            feedback: { summary: '情节不连贯', issues: [{ desc: '视角跳跃' }] }
        };
        const result = shouldOverrideReviewRejection(stepResult, 'content', 3000, 2200, [], {});
        expect(result.override).toBe(false);
    });
});
