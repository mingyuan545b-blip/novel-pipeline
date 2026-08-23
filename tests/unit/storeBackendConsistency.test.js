const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const sqliteStore = require('../../server/db/store');
const { trimItemData, isFoundationMaterialCheck, applyFilter } = require('../../server/db/storeCommon');

describe('Store Backend Consistency - trimItemData', () => {
    test('trimItemData handles chapters type', () => {
        const data = { id: 'ch-1', content: 'test', writerOutput: 'A'.repeat(10000) };
        const result = trimItemData('chapters', data);
        expect(result.id).toBe('ch-1');
        expect(result.content).toBe('test');
    });

    test('trimItemData handles materials type', () => {
        const data = { id: 'mat-1', type: 'worldview', name: 'Test', currentContent: 'content' };
        const result = trimItemData('materials', data);
        expect(result.id).toBe('mat-1');
    });

    test('trimItemData handles projects type', () => {
        const data = { id: 'proj-1', name: 'Test Project', mode: 'novel' };
        const result = trimItemData('projects', data);
        expect(result.id).toBe('proj-1');
    });

    test('trimItemData handles unknown type', () => {
        const data = { id: 'kv-1', key: 'value' };
        const result = trimItemData('pipeline-logs', data);
        expect(result.id).toBe('kv-1');
    });
});

describe('Store Backend Consistency - isFoundationMaterialCheck', () => {
    const getFactionFn = jest.fn(() => ({ parentPlane: null }));

    test('worldview with no parentPlane is foundation', () => {
        const mat = { type: 'worldview', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('power-system with no parentPlane is foundation', () => {
        const mat = { type: 'power-system', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('character with parentPlane is not foundation', () => {
        const mat = { type: 'character', parentPlane: 'subplane-1' };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(false);
    });

    test('mechanism with no parentPlane is foundation', () => {
        const mat = { type: 'mechanism', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('material with sourceChapter is not foundation', () => {
        const mat = { type: 'worldview', parentPlane: null, sourceChapter: 5 };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(false);
    });

    test('explicit isFoundation:true overrides inference', () => {
        const mat = { type: 'worldview', parentPlane: null, sourceChapter: 5, isFoundation: true };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('explicit isFoundation:false overrides inference', () => {
        const mat = { type: 'worldview', parentPlane: null, isFoundation: false };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(false);
    });

    test('faction with parentPlane null is foundation', () => {
        const mat = { type: 'faction', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('institution with parentPlane null is foundation', () => {
        const mat = { type: 'institution', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });

    test('writing-technique with no parentPlane is foundation', () => {
        const mat = { type: 'writing-technique', parentPlane: null };
        expect(isFoundationMaterialCheck(mat, getFactionFn)).toBe(true);
    });
});

describe('Store Backend Consistency - applyFilter', () => {
    const items = [
        { id: '1', projectId: 'p1', type: 'character', name: 'Alice' },
        { id: '2', projectId: 'p1', type: 'worldview', name: 'World' },
        { id: '3', projectId: 'p2', type: 'character', name: 'Bob' }
    ];

    test('filter by projectId', () => {
        const result = applyFilter(items, { projectId: 'p1' });
        expect(result.length).toBe(2);
    });

    test('filter by type', () => {
        const result = applyFilter(items, { type: 'character' });
        expect(result.length).toBe(2);
    });

    test('filter by multiple fields', () => {
        const result = applyFilter(items, { projectId: 'p1', type: 'character' });
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Alice');
    });

    test('filter with no match returns empty', () => {
        const result = applyFilter(items, { projectId: 'nonexistent' });
        expect(result.length).toBe(0);
    });

    test('filter with function', () => {
        const result = applyFilter(items, item => item.name.startsWith('A'));
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Alice');
    });

    test('filter with null returns all', () => {
        const result = applyFilter(items, null);
        expect(result.length).toBe(3);
    });

    test('filter with empty object returns all', () => {
        const result = applyFilter(items, {});
        expect(result.length).toBe(3);
    });
});

describe('Store Backend Consistency - SQLite CRUD', () => {
    beforeAll(async () => {
        await initDatabaseAsync(':memory:');
    });

    afterAll(() => {
        closeDatabase();
    });

    test('setItem then getItem returns same data', async () => {
        const data = { id: 'cons-1', name: 'Test', mode: 'novel', nested: { key: 'value' } };
        await sqliteStore.setItem('projects', 'cons-1', data);
        const result = await sqliteStore.getItem('projects', 'cons-1');
        expect(result.name).toBe('Test');
        expect(result.nested.key).toBe('value');
    });

    test('listItems returns all items of type', async () => {
        await sqliteStore.setItem('projects', 'list-1', { id: 'list-1', name: 'A', mode: 'novel' });
        await sqliteStore.setItem('projects', 'list-2', { id: 'list-2', name: 'B', mode: 'shuangwen' });
        const items = await sqliteStore.listItems('projects');
        expect(items.length).toBeGreaterThanOrEqual(2);
    });

    test('deleteItem then getItem returns null', async () => {
        await sqliteStore.setItem('projects', 'del-cons-1', { id: 'del-cons-1', name: 'ToDelete', mode: 'novel' });
        await sqliteStore.deleteItem('projects', 'del-cons-1');
        expect(await sqliteStore.getItem('projects', 'del-cons-1')).toBeNull();
    });
});
