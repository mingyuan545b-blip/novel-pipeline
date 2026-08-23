const mockResolveParentPlane = jest.fn();
const mockResolveParentFaction = jest.fn();

jest.mock('../../server/services/materialRefResolver', () => ({
    resolveParentPlane: mockResolveParentPlane,
    resolveParentFaction: mockResolveParentFaction
}));

const {
    checkDuplicates, checkParentReferences, buildIntegrityStats
} = require('../../server/services/materialIntegrityHelpers');

describe('materialIntegrityHelpers - branch coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkDuplicates', () => {
        test('returns empty for no duplicates', () => {
            const result = checkDuplicates([
                { id: '1', type: 'character', name: '角色A' },
                { id: '2', type: 'character', name: '角色B' },
            ]);
            expect(result).toEqual([]);
        });

        test('detects same-name same-type duplicates', () => {
            const result = checkDuplicates([
                { id: '1', type: 'character', name: '角色A' },
                { id: '2', type: 'character', name: '角色A' },
            ]);
            expect(result.length).toBe(1);
            expect(result[0].type).toBe('duplicate');
            expect(result[0].severity).toBe('critical');
        });

        test('no duplicate for same-name different-type', () => {
            const result = checkDuplicates([
                { id: '1', type: 'character', name: '名称', },
                { id: '2', type: 'equipment', name: '名称' },
            ]);
            expect(result).toEqual([]);
        });
    });

    describe('checkParentReferences', () => {
        test('skips sub-plane materials', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'sub-plane', name: '次位面' }
            ], 'proj1', []);
            expect(result).toEqual([]);
        });

        test('reports broken parentPlane', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'unresolved' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: 'broken-ref' }
            ], 'proj1', []);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('broken-parentPlane');
        });

        test('reports name-ref parentPlane', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'name-match', resolved: 'sp1', name: '次位面' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: '次位面' }
            ], 'proj1', []);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0].type).toBe('name-ref-parentPlane');
        });

        test('no issue for direct-id parentPlane', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'equipment', name: '宝剑', parentPlane: 'sp1' }
            ], 'proj1', []);
            expect(result).toEqual([]);
        });

        test('no issue for main-world parentPlane', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'main-world' });
            const result = await checkParentReferences([
                { id: '1', type: 'equipment', name: '宝剑', parentPlane: '主世界' }
            ], 'proj1', []);
            expect(result).toEqual([]);
        });

        test('reports missing parentFaction for character', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null }
            ], 'proj1', [
                { id: 'f1', name: '宗门', parentPlane: null }
            ]);
            expect(result.some(r => r.type === 'missing-parentFaction')).toBe(true);
        });

        test('no missing-parentFaction when no main factions', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'missing-parentFaction')).toBe(false);
        });

        test('reports broken parentFaction', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'unresolved' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null, parentFaction: 'broken' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'broken-parentFaction')).toBe(true);
        });

        test('reports name-ref parentFaction', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'name-match', resolved: 'f1', name: '宗门' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null, parentFaction: '宗门' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'name-ref-parentFaction')).toBe(true);
        });

        test('no issue for direct-id parentFaction', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null, parentFaction: 'f1' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'name-ref-parentFaction')).toBe(false);
        });

        test('no issue for no-faction parentFaction', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'no-faction' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null, parentFaction: '无' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'name-ref-parentFaction')).toBe(false);
        });

        test('reports orphan character without 主角/域外 in name', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '普通角色', parentPlane: null }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'orphan-character')).toBe(true);
        });

        test('skips orphan check for 主角 name', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '主角', parentPlane: null }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'orphan-character')).toBe(false);
        });

        test('skips orphan check for 域外 name', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '域外天魔', parentPlane: null }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'orphan-character')).toBe(false);
        });

        test('skips orphan check when character has parentFaction', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'direct-id' });
            const result = await checkParentReferences([
                { id: '1', type: 'character', name: '角色', parentPlane: null, parentFaction: 'f1' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'orphan-character')).toBe(false);
        });

        test('institution also gets parentFaction checks', async () => {
            mockResolveParentPlane.mockResolvedValue({ method: 'direct-id' });
            mockResolveParentFaction.mockResolvedValue({ method: 'unresolved' });
            const result = await checkParentReferences([
                { id: '1', type: 'institution', name: '组织', parentPlane: null, parentFaction: 'broken' }
            ], 'proj1', []);
            expect(result.some(r => r.type === 'broken-parentFaction')).toBe(true);
        });
    });

    describe('buildIntegrityStats', () => {
        test('counts materials by type', () => {
            const stats = buildIntegrityStats([
                { type: 'character', parentPlane: null },
                { type: 'character', parentPlane: 'sp1' },
                { type: 'equipment', parentPlane: null },
            ]);
            expect(stats.total).toBe(3);
            expect(stats.byType.character).toBe(2);
            expect(stats.byType.equipment).toBe(1);
        });

        test('counts characters by plane', () => {
            const stats = buildIntegrityStats([
                { type: 'character', parentPlane: null },
                { type: 'character', parentPlane: 'sp1' },
            ]);
            expect(stats.characters.mainWorld).toBe(1);
            expect(stats.characters.subPlane).toBe(1);
        });

        test('counts by plane', () => {
            const stats = buildIntegrityStats([
                { type: 'character', parentPlane: null },
                { type: 'equipment', parentPlane: 'sp1' },
            ]);
            expect(stats.byPlane['主世界']).toBe(1);
            expect(stats.byPlane['sp1']).toBe(1);
        });
    });
});
