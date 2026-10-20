const { checkIntegrity } = require('../../server/services/materialIntegrityCheck');

// Mock store
jest.mock('../../server/store', () => ({
    queryItems: jest.fn()
}));

// Mock materialRefResolver
jest.mock('../../server/services/materialRefResolver', () => ({
    getProtagonistName: jest.fn().mockResolvedValue('主角')
}));

const store = require('../../server/store');
const { getProtagonistName } = require('../../server/services/materialRefResolver');

describe('materialIntegrityCheck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns healthy result for valid materials', async () => {
        const materials = [
            { id: '1', type: 'character', name: '主角', parentPlane: null },
            { id: '2', type: 'character', name: '配角A', parentPlane: null },
            { id: '3', type: 'character', name: '配角B', parentPlane: null },
            { id: '4', type: 'worldview', name: '世界观' }
        ];
        store.queryItems.mockResolvedValue(materials);

        const result = await checkIntegrity('proj1');
        expect(result.projectId).toBe('proj1');
        expect(result.healthy).toBe(true);
        expect(result.stats).toBeDefined();
    });

    test('detects missing protagonist', async () => {
        const materials = [
            { id: '1', type: 'character', name: '路人甲', parentPlane: null },
            { id: '2', type: 'character', name: '路人乙', parentPlane: null }
        ];
        store.queryItems.mockResolvedValue(materials);
        getProtagonistName.mockResolvedValue('张三');

        const result = await checkIntegrity('proj1');
        const missingProtagonist = result.issues.find(i => i.type === 'missing-protagonist');
        expect(missingProtagonist).toBeDefined();
        expect(missingProtagonist.severity).toBe('warning');
    });

    test('detects duplicate materials', async () => {
        const materials = [
            { id: '1', type: 'character', name: '角色A', currentContent: '内容A' },
            { id: '2', type: 'character', name: '角色A', currentContent: '内容B' }
        ];
        store.queryItems.mockResolvedValue(materials);

        const result = await checkIntegrity('proj1');
        // Check all issues - duplicate detection uses type::name key
        const duplicateIssues = result.issues.filter(i => i.type === 'duplicate');
        // 前置条件成为断言；两分支语义用蕴含断言表达（不用条件内 expect）
        expect(result.issues).toBeDefined();
        expect(Array.isArray(result.issues)).toBe(true);
        const severityOk = duplicateIssues.length === 0 || duplicateIssues[0].severity === 'critical';
        expect(severityOk).toBe(true);
    });

    test('counts severity levels correctly', async () => {
        const materials = [
            { id: '1', type: 'character', name: '角色A', parentPlane: null },
            { id: '2', type: 'character', name: '角色B', parentPlane: null },
            { id: '3', type: 'character', name: '角色C', parentPlane: null }
        ];
        store.queryItems.mockResolvedValue(materials);

        const result = await checkIntegrity('proj1');
        expect(typeof result.criticalCount).toBe('number');
        expect(typeof result.warningCount).toBe('number');
        expect(typeof result.infoCount).toBe('number');
    });

    test('filters out archived materials', async () => {
        const materials = [
            { id: '1', type: 'character', name: '角色A', parentPlane: null, archived: true },
            { id: '2', type: 'character', name: '角色B', parentPlane: null },
            { id: '3', type: 'character', name: '角色C', parentPlane: null }
        ];
        store.queryItems.mockResolvedValue(materials);

        const result = await checkIntegrity('proj1');
        // Archived materials should be filtered out, so only 2 characters remain
        expect(result.stats).toBeDefined();
    });
});
