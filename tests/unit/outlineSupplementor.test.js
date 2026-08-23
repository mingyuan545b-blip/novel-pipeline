const { calculateSmartBatchSize } = require('../../server/services/pipeline/infinite/outlineSupplementor');

describe('outlineSupplementor - calculateSmartBatchSize', () => {
    test('returns min(5, remaining) for early progress', () => {
        const chapters = Array.from({ length: 5 }, (_, i) => ({
            chapterNumber: i + 1,
            status: i < 1 ? 'material-updated' : 'outlined'
        }));
        expect(calculateSmartBatchSize(chapters, 30)).toBe(5);
    });

    test('returns min(3, remaining) for mid progress', () => {
        const chapters = Array.from({ length: 10 }, (_, i) => ({
            chapterNumber: i + 1,
            status: i < 5 ? 'material-updated' : 'outlined'
        }));
        expect(calculateSmartBatchSize(chapters, 30)).toBe(3);
    });

    test('returns min(2, remaining) for late progress', () => {
        const chapters = Array.from({ length: 20 }, (_, i) => ({
            chapterNumber: i + 1,
            status: i < 14 ? 'material-updated' : 'outlined'
        }));
        expect(calculateSmartBatchSize(chapters, 30)).toBe(2);
    });

    test('returns 0 when max chapters reached', () => {
        const chapters = Array.from({ length: 30 }, (_, i) => ({
            chapterNumber: i + 1,
            status: 'material-updated'
        }));
        expect(calculateSmartBatchSize(chapters, 30)).toBe(0);
    });

    test('respects maxChapters limit', () => {
        const chapters = Array.from({ length: 28 }, (_, i) => ({
            chapterNumber: i + 1,
            status: i < 5 ? 'material-updated' : 'outlined'
        }));
        expect(calculateSmartBatchSize(chapters, 30)).toBe(2);
    });
});
