jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    queryItems: jest.fn()
}));

const store = require('../../server/store');
const { getVisibleMaterials } = require('../../server/services/pipeline/volumeHelpers');
const { buildVolumeRhythmGuidance } = require('../../server/services/pipeline/volumeRhythm');

describe('volumeHelpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockResolvedValue(null);
        store.queryItems.mockResolvedValue([]);
    });

    describe('getVisibleMaterials', () => {
        test('filters out archived materials', async () => {
            store.getItem.mockResolvedValue({ styleProfile: {} });
            store.queryItems.mockResolvedValue([
                { id: 'm1', type: 'worldview', name: 'W1', archived: true },
                { id: 'm2', type: 'worldview', name: 'W2', archived: false }
            ]);
            const result = await getVisibleMaterials('proj1', 1);
            expect(result.materials.length).toBe(1);
            expect(result.materials[0].id).toBe('m2');
        });

        test('always includes main world characters', async () => {
            store.getItem.mockResolvedValue({ styleProfile: { protagonistName: '主角' } });
            store.queryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '主角', parentPlane: null },
                { id: 'c2', type: 'character', name: '配角', parentPlane: 'locked-plane' }
            ]);
            const result = await getVisibleMaterials('proj1', 1);
            const names = result.materials.map(m => m.name);
            expect(names).toContain('主角');
        });

        test('includes protagonist even in other plane', async () => {
            store.getItem.mockResolvedValue({ styleProfile: { protagonistName: '主角' } });
            store.queryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '主角', parentPlane: 'other-plane' }
            ]);
            const result = await getVisibleMaterials('proj1', 1);
            expect(result.materials.some(m => m.name === '主角')).toBe(true);
        });

        test('includes non-plane-specific material types', async () => {
            store.getItem.mockResolvedValue({ styleProfile: {} });
            store.queryItems.mockResolvedValue([
                { id: 'm1', type: 'catchphrase', name: '金句1' },
                { id: 'm2', type: 'famous-scene', name: '名场面1' }
            ]);
            const result = await getVisibleMaterials('proj1', 1);
            expect(result.materials.length).toBe(2);
        });

        test('returns debug info', async () => {
            store.getItem.mockResolvedValue({ styleProfile: {} });
            store.queryItems.mockResolvedValue([]);
            const result = await getVisibleMaterials('proj1', 1);
            expect(result.debug).toBeDefined();
            expect(result.debug.totalMaterials).toBe(0);
            expect(result.currentVolume).toBe(1);
        });

        test('accepts volume object input', async () => {
            store.getItem.mockResolvedValue({ styleProfile: {} });
            store.queryItems.mockResolvedValue([]);
            const result = await getVisibleMaterials('proj1', { volume: 2 });
            expect(result.currentVolume).toBe(2);
        });
    });

    describe('buildVolumeRhythmGuidance', () => {
        test('includes volume and chapter info', async () => {
            store.queryItems.mockImplementation((storeType) => {
                if (storeType === 'chapters') return Promise.resolve([]);
                if (storeType === 'materials') return Promise.resolve([]);
                return Promise.resolve([]);
            });
            const guidance = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(guidance).toContain('当前卷节奏状态');
            expect(guidance).toContain('卷');
        });

        test('shows unlocked subplanes', async () => {
            store.queryItems.mockImplementation((storeType) => {
                if (storeType === 'chapters') return Promise.resolve([]);
                if (storeType === 'materials') return Promise.resolve([{ name: '副本A', type: 'sub-plane', isLocked: false }]);
                return Promise.resolve([]);
            });
            const guidance = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(guidance).toContain('副本A');
        });

        test('shows locked subplanes', async () => {
            store.queryItems.mockImplementation((storeType) => {
                if (storeType === 'chapters') return Promise.resolve([]);
                if (storeType === 'materials') return Promise.resolve([{ name: '副本B', type: 'sub-plane', isLocked: true }]);
                return Promise.resolve([]);
            });
            const guidance = await buildVolumeRhythmGuidance('proj1', 30, 0);
            expect(guidance).toContain('副本B');
        });
    });
});
