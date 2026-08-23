const mockQueryItems = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockReadFileSync = jest.fn(() => JSON.stringify({
    volumeOrder: [{ volume: 1, subplaneId: 'sp1', subplaneName: '小世界···幽冥界' }]
}));

jest.mock('../../server/store', () => ({
    queryItems: mockQueryItems,
    getItem: mockGetItem,
    setItem: mockSetItem
}));

jest.mock('fs', () => ({
    readFileSync: mockReadFileSync
}));

const {
    getVolumeOrder, getVolumeSubplane, getVisibleMaterials, enforceVolumeSubplaneLocks
} = require('../../server/services/pipeline/volumeHelpers');

describe('volumeHelpers - branch coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReadFileSync.mockImplementation(() => JSON.stringify({
            volumeOrder: [{ volume: 1, subplaneId: 'sp1', subplaneName: '小世界···幽冥界' }]
        }));
    });

    describe('getVolumeOrder', () => {
        test('returns cached order on second call', async () => {
            mockGetItem.mockResolvedValue({ genre: 'causal-eye-strategy' });
            const r1 = await getVolumeOrder('p1');
            const r2 = await getVolumeOrder('p1');
            expect(r1).toBeTruthy();
            expect(r2).toBe(r1);
        });

        test('uses default file for unknown genre', async () => {
            mockGetItem.mockResolvedValue({ genre: 'unknown-genre' });
            const result = await getVolumeOrder('p2');
            expect(result).toBeTruthy();
        });

        test('returns null when file not found', async () => {
            mockReadFileSync.mockImplementation(() => { throw new Error('not found'); });
            mockGetItem.mockResolvedValue(null);
            const result = await getVolumeOrder(null);
            expect(result).toBeNull();
        });

        test('uses styleProfile.key as genre fallback', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: { key: 'witty-strategy' } });
            const result = await getVolumeOrder('p3');
            expect(result).toBeTruthy();
        });
    });

    describe('getVolumeSubplane', () => {
        test('finds entry from volume order', async () => {
            mockGetItem.mockResolvedValue({ genre: 'causal-eye-strategy' });
            const result = await getVolumeSubplane('p1', 5);
            expect(result).toBeTruthy();
            expect(result.volume).toBe(1);
        });

        test('falls back to unlocked subplane materials', async () => {
            mockReadFileSync.mockImplementation(() => { throw new Error('not found'); });
            mockGetItem.mockResolvedValue(null);
            mockQueryItems.mockResolvedValue([
                { id: 'sp1', name: '小世界···幽冥界', isLocked: false, type: 'sub-plane' }
            ]);
            const result = await getVolumeSubplane('p1', 5);
            expect(result).toBeTruthy();
            expect(result.subplaneId).toBe('sp1');
        });

        test('returns null when no unlocked subplanes', async () => {
            mockReadFileSync.mockImplementation(() => { throw new Error('not found'); });
            mockGetItem.mockResolvedValue(null);
            mockQueryItems.mockResolvedValue([
                { id: 'sp1', name: '小世界···幽冥界', isLocked: true, type: 'sub-plane' }
            ]);
            const result = await getVolumeSubplane('p1', 5);
            expect(result).toBeNull();
        });

        test('returns null when no volume order and no subplanes', async () => {
            mockReadFileSync.mockImplementation(() => { throw new Error('not found'); });
            mockGetItem.mockResolvedValue(null);
            mockQueryItems.mockResolvedValue([]);
            const result = await getVolumeSubplane('p1', 5);
            expect(result).toBeNull();
        });
    });

    describe('getVisibleMaterials', () => {
        test('filters with object target (volume)', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: { protagonistName: '主角' } });
            mockQueryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '主角', parentPlane: null, archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', { volume: 1 });
            expect(result.materials.length).toBeGreaterThan(0);
            expect(result.currentVolume).toBe(1);
        });

        test('filters with number target (chapter)', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '角色', archived: false }
            ]);
            const result = await getVisibleMaterials('p1', 5);
            expect(result.materials).toBeDefined();
            expect(result.debug).toBeDefined();
        });

        test('excludes archived materials', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'a1', type: 'character', name: '已归档', archived: true },
                { id: 'a2', type: 'character', name: '未归档', archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            const names = result.materials.map(m => m.name);
            expect(names).not.toContain('已归档');
            expect(names).toContain('未归档');
        });

        test('protagonist always visible regardless of parentPlane', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: { protagonistName: '主角' } });
            mockQueryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '主角', parentPlane: 'locked-sp', archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '主角')).toBe(true);
        });

        test('character with currentPlaneId in allowedCurrentPlanes is visible', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '角色X', parentPlane: 'locked-sp', currentPlaneId: 'sp1', archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '角色X')).toBe(true);
        });

        test('equipment with parentPlane in allowedParentPlanes is visible', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'e1', type: 'equipment', name: '宝剑', parentPlane: '主世界', archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '宝剑')).toBe(true);
        });

        test('equipment with parentPlane matching subplane short name is visible', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'e1', type: 'equipment', name: '法宝', parentPlane: '幽冥界', archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '法宝')).toBe(true);
        });

        test('character with unrecognized parentPlane is filtered out', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'c1', type: 'character', name: '异界人', parentPlane: 'locked-sp', archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '异界人')).toBe(false);
        });

        test('other type materials always pass through', async () => {
            mockGetItem.mockResolvedValue({ styleProfile: {} });
            mockQueryItems.mockResolvedValue([
                { id: 'o1', type: 'other', name: '杂项', parentPlane: 'sp1', archived: false },
                { id: 'sp1', type: 'sub-plane', name: '小世界···幽冥界', isLocked: false, archived: false },
            ]);
            const result = await getVisibleMaterials('p1', 1);
            expect(result.materials.some(m => m.name === '杂项')).toBe(true);
        });
    });

    describe('enforceVolumeSubplaneLocks', () => {
        test('unlocks matching subplane and locks others', async () => {
            mockGetItem.mockResolvedValue({ genre: 'causal-eye-strategy' });
            mockQueryItems.mockResolvedValue([
                { id: 'sp1', name: '小世界···幽冥界', isLocked: false, type: 'sub-plane' },
                { id: 'sp2', name: '小世界···天界', isLocked: false, type: 'sub-plane' },
            ]);
            mockSetItem.mockResolvedValue(true);

            await enforceVolumeSubplaneLocks('p1', 5);
            expect(mockSetItem).toHaveBeenCalled();
        });

        test('does nothing when no volume entry', async () => {
            mockReadFileSync.mockImplementation(() => { throw new Error('not found'); });
            mockGetItem.mockResolvedValue(null);
            mockQueryItems.mockResolvedValue([]);

            await enforceVolumeSubplaneLocks('p1', 5);
            expect(mockSetItem).not.toHaveBeenCalled();
        });
    });
});
