const { trimItemData, applySizeLimit, isFoundationMaterialCheck, applyFilter } = require('../../server/db/storeCommon');

describe('storeCommon', () => {
    describe('applyFilter', () => {
        test('returns items unchanged when no filter', () => {
            const items = [{ id: '1' }, { id: '2' }];
            expect(applyFilter(items, null)).toBe(items);
        });

        test('filters by object properties', () => {
            const items = [
                { id: '1', type: 'character', name: 'A' },
                { id: '2', type: 'worldview', name: 'B' }
            ];
            const result = applyFilter(items, { type: 'character' });
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('A');
        });

        test('filters by function', () => {
            const items = [1, 2, 3, 4, 5];
            const result = applyFilter(items, n => n > 3);
            expect(result).toEqual([4, 5]);
        });

        test('returns empty for no matches', () => {
            const items = [{ id: '1', type: 'character' }];
            const result = applyFilter(items, { type: 'nonexistent' });
            expect(result.length).toBe(0);
        });

        test('matches multiple properties', () => {
            const items = [
                { id: '1', type: 'character', name: 'A' },
                { id: '2', type: 'character', name: 'B' },
                { id: '3', type: 'worldview', name: 'A' }
            ];
            const result = applyFilter(items, { type: 'character', name: 'A' });
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('isFoundationMaterialCheck', () => {
        const getFactionFn = jest.fn().mockReturnValue(null);

        test('returns false for null', () => {
            expect(isFoundationMaterialCheck(null, getFactionFn)).toBe(false);
        });

        test('returns true for isFoundation=true', () => {
            expect(isFoundationMaterialCheck({ isFoundation: true }, getFactionFn)).toBe(true);
        });

        test('returns false for isFoundation=false', () => {
            expect(isFoundationMaterialCheck({ isFoundation: false }, getFactionFn)).toBe(false);
        });

        test('returns false for sourceChapter', () => {
            expect(isFoundationMaterialCheck({ sourceChapter: 5 }, getFactionFn)).toBe(false);
        });

        test('returns true for worldview without parentPlane', () => {
            expect(isFoundationMaterialCheck({ type: 'worldview' }, getFactionFn)).toBe(true);
        });

        test('returns true for power-system without parentPlane', () => {
            expect(isFoundationMaterialCheck({ type: 'power-system' }, getFactionFn)).toBe(true);
        });

        test('returns true for faction with null parentPlane', () => {
            expect(isFoundationMaterialCheck({ type: 'faction', parentPlane: null }, getFactionFn)).toBe(true);
        });

        test('returns false at depth > 5', () => {
            expect(isFoundationMaterialCheck({ type: 'other' }, getFactionFn, new Set(), 6)).toBe(false);
        });

        test('returns false for unknown type', () => {
            expect(isFoundationMaterialCheck({ type: 'other' }, getFactionFn)).toBe(false);
        });
    });

    describe('trimItemData', () => {
        test('returns data unchanged when within size limit', () => {
            const data = { id: '1', name: 'test' };
            const result = trimItemData('unknown-type', data);
            expect(result.name).toBe('test');
        });

        test('truncates chapter output fields when oversized', () => {
            // chapters size limit is 2MB (2097152 bytes)
            // Need serialized data > 2MB to trigger trim
            const bigContent = 'X'.repeat(2200000);
            const data = {
                id: '1',
                history: Array.from({ length: 30 }, (_, i) => ({ v: i, text: 'H' })),
                writerOutput: bigContent,
                firstReviewOutput: bigContent
            };
            const result = trimItemData('chapters', data);
            // After trim, output fields should be truncated (outputTruncateLength=9900)
            expect(result.writerOutput.length).toBeLessThan(bigContent.length);
            expect(result.writerOutput).toContain('[truncated]');
            // History should be trimmed (chapterHistoryKeep=5)
            expect(result.history.length).toBeLessThanOrEqual(5);
        });

        test('trims material changeLog when oversized', () => {
            // materials size limit is 512KB (524288 bytes)
            const bigContent = 'Y'.repeat(600000);
            const changeLog = Array.from({ length: 200 }, (_, i) => ({ v: i, text: 'D' }));
            const data = { id: '1', changeLog, currentContent: bigContent };
            const result = trimItemData('materials', data);
            if (result.changeLog) {
                expect(result.changeLog.length).toBeLessThanOrEqual(50);
            }
        });

        test('trims project fields when oversized', () => {
            // projects size limit is 512KB (524288 bytes)
            const bigDesc = 'Z'.repeat(600000);
            const data = {
                id: '1',
                description: bigDesc,
                chapters: Array.from({ length: 500 }, (_, i) => i),
                chapterIntents: { chapters: Array.from({ length: 500 }, (_, i) => ({ v: i })) }
            };
            const result = trimItemData('projects', data);
            // projectDescriptionMaxLength=5000
            expect(result.description.length).toBeLessThanOrEqual(5000);
        });
    });

    describe('applySizeLimit', () => {
        test('returns serialized and oversized flag', () => {
            const data = { id: '1' };
            const result = applySizeLimit('unknown-type', data);
            expect(result.serialized).toBeDefined();
            expect(typeof result.oversized).toBe('boolean');
        });

        test('small data is not oversized', () => {
            const data = { id: '1', name: 'test' };
            const result = applySizeLimit('chapters', data);
            expect(result.oversized).toBe(false);
        });

        test('large data is oversized', () => {
            const data = { id: '1', content: 'A'.repeat(2200000) };
            const result = applySizeLimit('chapters', data);
            expect(result.oversized).toBe(true);
        });
    });
});
