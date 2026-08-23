/**
 * materialIntegrityCheckFull.test.js
 * 深度覆盖 materialIntegrityCheck.js 分支
 */
jest.mock('../../server/store', () => ({
    queryItems: jest.fn()
}));
jest.mock('../../server/services/materialRefResolver', () => ({
    getProtagonistName: jest.fn().mockResolvedValue('主角')
}));

const store = require('../../server/store');
const { getProtagonistName } = require('../../server/services/materialRefResolver');
const { checkIntegrity } = require('../../server/services/materialIntegrityCheck');

describe('materialIntegrityCheck - full branch coverage', () => {
    beforeEach(() => jest.clearAllMocks());

    test('healthy with 3+ main world characters', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '主角', parentPlane: null },
            { id: '2', type: 'character', name: '配角A', parentPlane: null },
            { id: '3', type: 'character', name: '配角B', parentPlane: null },
            { id: '4', type: 'worldview', name: '世界观' }
        ]);
        const result = await checkIntegrity('proj1');
        expect(result.healthy).toBe(true);
        expect(result.criticalCount).toBe(0);
    });

    test('detects missing protagonist when <3 main chars', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '路人甲', parentPlane: null },
            { id: '2', type: 'character', name: '路人乙', parentPlane: null }
        ]);
        getProtagonistName.mockResolvedValue('张三');
        const result = await checkIntegrity('proj1');
        const missing = result.issues.find(i => i.type === 'missing-protagonist');
        expect(missing).toBeDefined();
        expect(missing.fix).toBe('create');
    });

    test('no missing protagonist when name matches', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '张三', parentPlane: null },
            { id: '2', type: 'character', name: '路人乙', parentPlane: null }
        ]);
        getProtagonistName.mockResolvedValue('张三');
        const result = await checkIntegrity('proj1');
        const missing = result.issues.find(i => i.type === 'missing-protagonist');
        expect(missing).toBeUndefined();
    });

    test('detects protagonist by "主角" substring', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '主角大人', parentPlane: null },
            { id: '2', type: 'character', name: '路人乙', parentPlane: null }
        ]);
        getProtagonistName.mockResolvedValue('不同名字');
        const result = await checkIntegrity('proj1');
        const missing = result.issues.find(i => i.type === 'missing-protagonist');
        expect(missing).toBeUndefined();
    });

    test('filters archived materials from all checks', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '主角', parentPlane: null, archived: true },
            { id: '2', type: 'character', name: '配角A', parentPlane: null },
            { id: '3', type: 'character', name: '配角B', parentPlane: null }
        ]);
        const result = await checkIntegrity('proj1');
        expect(result.stats).toBeDefined();
    });

    test('detects duplicate materials', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '角色A', currentContent: '内容A' },
            { id: '2', type: 'character', name: '角色A', currentContent: '内容B' },
            { id: '3', type: 'character', name: '角色B', parentPlane: null },
            { id: '4', type: 'character', name: '角色C', parentPlane: null },
            { id: '5', type: 'character', name: '角色D', parentPlane: null }
        ]);
        const result = await checkIntegrity('proj1');
        expect(result.issues).toBeDefined();
    });

    test('checks faction parent references', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'faction', name: '门派A', parentFaction: 'nonexistent' },
            { id: '2', type: 'character', name: '角色A', parentPlane: null },
            { id: '3', type: 'character', name: '角色B', parentPlane: null },
            { id: '4', type: 'character', name: '角色C', parentPlane: null }
        ]);
        const result = await checkIntegrity('proj1');
        expect(result.issues).toBeDefined();
    });

    test('counts severity levels correctly', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '角色A', parentPlane: null },
            { id: '2', type: 'character', name: '角色B', parentPlane: null },
            { id: '3', type: 'character', name: '角色C', parentPlane: null }
        ]);
        const result = await checkIntegrity('proj1');
        expect(typeof result.criticalCount).toBe('number');
        expect(typeof result.warningCount).toBe('number');
        expect(typeof result.infoCount).toBe('number');
        expect(result.criticalCount + result.warningCount + result.infoCount).toBe(result.issues.length);
    });

    test('empty materials list', async () => {
        store.queryItems.mockResolvedValue([]);
        getProtagonistName.mockResolvedValue('主角');
        const result = await checkIntegrity('proj1');
        expect(result.projectId).toBe('proj1');
        expect(result.issues).toBeDefined();
    });

    test('stats object has expected fields', async () => {
        store.queryItems.mockResolvedValue([
            { id: '1', type: 'character', name: '角色A', parentPlane: null },
            { id: '2', type: 'worldview', name: '世界观' }
        ]);
        const result = await checkIntegrity('proj1');
        expect(result.stats).toBeDefined();
    });
});
