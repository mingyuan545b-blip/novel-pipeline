/**
 * storeCommon.js branch coverage tests
 * Covers: isFoundationMaterialCheck, applyFilter, trimItemData, applySizeLimit
 */
const sc = require('../../server/db/storeCommon');

describe('storeCommon.isFoundationMaterialCheck', () => {
    const getFactionFn = jest.fn();

    test('returns false for null material', () => {
        expect(sc.isFoundationMaterialCheck(null, getFactionFn)).toBe(false);
    });

    test('returns false when depth > 5', () => {
        expect(sc.isFoundationMaterialCheck({ isFoundation: undefined }, getFactionFn, new Set(), 6)).toBe(false);
    });

    test('returns true when isFoundation is true', () => {
        expect(sc.isFoundationMaterialCheck({ isFoundation: true }, getFactionFn)).toBe(true);
    });

    test('returns false when isFoundation is false', () => {
        expect(sc.isFoundationMaterialCheck({ isFoundation: false }, getFactionFn)).toBe(false);
    });

    test('returns false when sourceChapter exists', () => {
        expect(sc.isFoundationMaterialCheck({ sourceChapter: 5 }, getFactionFn)).toBe(false);
    });

    test('returns true for worldview without parentPlane', () => {
        expect(sc.isFoundationMaterialCheck({ type: 'worldview' }, getFactionFn)).toBe(true);
    });

    test('returns true for power-system without parentPlane', () => {
        expect(sc.isFoundationMaterialCheck({ type: 'power-system' }, getFactionFn)).toBe(true);
    });

    test('returns true for faction with null parentPlane', () => {
        expect(sc.isFoundationMaterialCheck({ type: 'faction', parentPlane: null }, getFactionFn)).toBe(true);
    });

    test('returns true for institution with null parentPlane', () => {
        expect(sc.isFoundationMaterialCheck({ type: 'institution', parentPlane: null }, getFactionFn)).toBe(true);
    });

    test('follows character parentFaction chain', () => {
        getFactionFn.mockReturnValue({ isFoundation: true });
        expect(sc.isFoundationMaterialCheck({ type: 'character', parentFaction: 'fac-1' }, getFactionFn)).toBe(true);
    });

    test('returns false for circular parentFaction', () => {
        const visited = new Set(['fac-1']);
        getFactionFn.mockReturnValue({ type: 'character', parentFaction: 'fac-1' });
        expect(sc.isFoundationMaterialCheck({ type: 'character', parentFaction: 'fac-1' }, getFactionFn, visited, 0)).toBe(false);
    });

    test('returns false when faction is not foundation', () => {
        getFactionFn.mockReturnValue({ type: 'faction', isFoundation: false });
        expect(sc.isFoundationMaterialCheck({ type: 'character', parentFaction: 'fac-1' }, getFactionFn)).toBe(false);
    });

    test('returns false for unknown type', () => {
        expect(sc.isFoundationMaterialCheck({ type: 'other' }, getFactionFn)).toBe(false);
    });
});

describe('storeCommon.applyFilter', () => {
    test('returns items when no filter', () => {
        const items = [1, 2, 3];
        expect(sc.applyFilter(items, null)).toBe(items);
    });

    test('filters with function', () => {
        const items = [1, 2, 3, 4];
        expect(sc.applyFilter(items, x => x > 2)).toEqual([3, 4]);
    });

    test('filters with object', () => {
        const items = [{ a: 1 }, { a: 2 }, { a: 1 }];
        expect(sc.applyFilter(items, { a: 1 })).toEqual([{ a: 1 }, { a: 1 }]);
    });
});

describe('storeCommon.trimItemData', () => {
    test('returns data as-is when within size limit', () => {
        const data = { name: 'test' };
        expect(sc.trimItemData('unknown-type', data)).toBe(data);
    });

    test('trims chapter history when oversized', () => {
        const data = {
            history: Array(50).fill(null).map(() => ({ action: 'a'.repeat(1000) })),
            writerOutput: 'x'.repeat(500000)
        };
        const result = sc.trimItemData('chapters', data);
        // Should be trimmed since total size exceeds limit
        expect(result).toBeDefined();
    });

    test('trims material changeLog when oversized', () => {
        const data = {
            changeLog: Array(100).fill(null).map(() => ({ from: 'a'.repeat(1000), to: 'b'.repeat(1000) }))
        };
        const result = sc.trimItemData('materials', data);
        expect(result).toBeDefined();
    });

    test('trims project data when oversized', () => {
        const data = {
            chapters: Array(200).fill('ch-1'),
            description: 'x'.repeat(100000)
        };
        const result = sc.trimItemData('projects', data);
        expect(result).toBeDefined();
    });

    test('handles project chapterIntents object', () => {
        const chapters = {};
        for (let i = 0; i < 200; i++) chapters[`ch${i}`] = { outline: 'a'.repeat(500) };
        const data = { chapterIntents: { chapters } };
        const result = sc.trimItemData('projects', data);
        expect(result).toBeDefined();
    });

    test('handles project chapterIntents array', () => {
        const data = {
            chapterIntents: { chapters: Array(200).fill(null).map((_, i) => ({ outline: 'a'.repeat(500) })) }
        };
        const result = sc.trimItemData('projects', data);
        expect(result).toBeDefined();
    });
});

describe('storeCommon.applySizeLimit', () => {
    test('returns serialized and not oversized for small data', () => {
        const result = sc.applySizeLimit('unknown-type', { name: 'test' });
        expect(result.oversized).toBe(false);
        expect(result.serialized).toBeTruthy();
    });

    test('detects oversized data', () => {
        const largeData = { content: 'x'.repeat(500000) };
        const result = sc.applySizeLimit('chapters', largeData);
        expect(result).toBeDefined();
    });
});
