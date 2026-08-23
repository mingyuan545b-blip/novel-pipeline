// Mock store before requiring volumeHelpers
const mockQueryItems = jest.fn();
const mockGetItem = jest.fn();

jest.mock('../../server/store', () => ({
    queryItems: mockQueryItems,
    getItem: mockGetItem
}));

const { buildVolumeRhythmGuidance } = require('../../server/services/pipeline/volumeRhythm');

describe('volumeHelpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('buildVolumeRhythmGuidance', () => {
        test('generates guidance for early volume', async () => {
            mockQueryItems
                .mockResolvedValueOnce([]) // chapters call
                .mockResolvedValueOnce([]); // sub-plane materials call
            mockGetItem.mockResolvedValue({ styleProfile: {} });

            const result = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(result).toContain('当前卷节奏状态');
            expect(result).toContain('第1卷');
            expect(result).toContain('主世界铺垫');
        });

        test('generates guidance for mid volume', async () => {
            const chapters = Array.from({ length: 15 }, (_, i) => ({
                chapterNumber: i + 1, outline: `第${i + 1}章`, title: `第${i + 1}章`
            }));
            mockQueryItems
                .mockResolvedValueOnce(chapters)
                .mockResolvedValueOnce([]);
            mockGetItem.mockResolvedValue({ styleProfile: {} });

            const result = await buildVolumeRhythmGuidance('proj1', 30, 15);
            expect(result).toContain('深入小世界探索');
        });

        test('generates guidance for late volume', async () => {
            const chapters = Array.from({ length: 28 }, (_, i) => ({
                chapterNumber: i + 1, outline: `第${i + 1}章`, title: `第${i + 1}章`
            }));
            mockQueryItems
                .mockResolvedValueOnce(chapters)
                .mockResolvedValueOnce([]);
            mockGetItem.mockResolvedValue({ styleProfile: {} });

            const result = await buildVolumeRhythmGuidance('proj1', 30, 28);
            expect(result).toContain('主世界回响');
        });

        test('includes unlocked subplane info', async () => {
            mockQueryItems
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    { name: '小世界···秘境', isLocked: false },
                    { name: '小世界···深渊', isLocked: true }
                ]);
            mockGetItem.mockResolvedValue({ styleProfile: {} });

            const result = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(result).toContain('秘境');
            expect(result).toContain('深渊');
        });

        test('includes key reminder about one subplane per volume', async () => {
            mockQueryItems
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            mockGetItem.mockResolvedValue({ styleProfile: {} });

            const result = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(result).toContain('本卷只能使用一个小世界');
        });
    });
});
