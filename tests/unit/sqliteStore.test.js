const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const store = require('../../server/db/store');

beforeAll(async () => {
    await initDatabaseAsync(':memory:');
});

afterAll(() => {
    closeDatabase();
});

describe('SQLite Store - updateItem', () => {
    test('updateItem modifies existing item', async () => {
        await store.setItem('projects', 'upd-test-1', { id: 'upd-test-1', name: 'Before', mode: 'novel' });
        const result = await store.updateItem('projects', 'upd-test-1', (item) => {
            item.name = 'After';
            return item;
        });
        expect(result.name).toBe('After');
        const retrieved = await store.getItem('projects', 'upd-test-1');
        expect(retrieved.name).toBe('After');
    });

    test('updateItem returns null for non-existent item', async () => {
        const result = await store.updateItem('projects', 'nonexistent-upd', (item) => item);
        expect(result).toBeNull();
    });

    test('updateItem returns current when updateFn returns falsy', async () => {
        await store.setItem('projects', 'upd-test-2', { id: 'upd-test-2', name: 'Keep', mode: 'novel' });
        const result = await store.updateItem('projects', 'upd-test-2', () => null);
        expect(result.name).toBe('Keep');
    });
});

describe('SQLite Store - Lock Mechanism', () => {
    test('concurrent setItem to same key serializes', async () => {
        await store.setItem('projects', 'lock-test-1', { id: 'lock-test-1', name: 'Original', mode: 'novel' });
        const updates = [];
        for (let i = 0; i < 5; i++) {
            updates.push(store.updateItem('projects', 'lock-test-1', (item) => {
                item.counter = (item.counter || 0) + 1;
                return item;
            }));
        }
        await Promise.all(updates);
        const result = await store.getItem('projects', 'lock-test-1');
        expect(result.counter).toBe(5);
    });

    test('concurrent setItem to different keys parallelizes', async () => {
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(store.setItem('projects', `parallel-${i}`, { id: `parallel-${i}`, name: `Item ${i}`, mode: 'novel' }));
        }
        await Promise.all(promises);
        for (let i = 0; i < 5; i++) {
            const item = await store.getItem('projects', `parallel-${i}`);
            expect(item).not.toBeNull();
            expect(item.name).toBe(`Item ${i}`);
        }
    });
});

describe('SQLite Store - isFoundationMaterial', () => {
    test('worldview with no parentPlane is foundation', async () => {
        await store.setItem('materials', 'found-wv-1', {
            id: 'found-wv-1', projectId: 'found-proj', type: 'worldview',
            name: 'Test World', currentContent: 'content', parentPlane: null
        });
        expect(await store.isFoundationMaterial(await store.getItem('materials', 'found-wv-1'))).toBe(true);
    });

    test('character with parentPlane is not foundation', async () => {
        await store.setItem('materials', 'found-ch-1', {
            id: 'found-ch-1', projectId: 'found-proj', type: 'character',
            name: 'NPC', currentContent: 'content', parentPlane: 'subplane-1'
        });
        expect(await store.isFoundationMaterial(await store.getItem('materials', 'found-ch-1'))).toBe(false);
    });

    test('mechanism with no parentPlane is foundation', async () => {
        await store.setItem('materials', 'found-mech-1', {
            id: 'found-mech-1', projectId: 'found-proj', type: 'mechanism',
            name: 'Test Mechanism', currentContent: 'content', parentPlane: null
        });
        expect(await store.isFoundationMaterial(await store.getItem('materials', 'found-mech-1'))).toBe(true);
    });

    test('material with sourceChapter is not foundation', async () => {
        await store.setItem('materials', 'found-src-1', {
            id: 'found-src-1', projectId: 'found-proj', type: 'worldview',
            name: 'Generated', currentContent: 'content', parentPlane: null, sourceChapter: 5
        });
        expect(await store.isFoundationMaterial(await store.getItem('materials', 'found-src-1'))).toBe(false);
    });

    test('explicit isFoundation:true overrides inference', async () => {
        await store.setItem('materials', 'found-exp-1', {
            id: 'found-exp-1', projectId: 'found-proj', type: 'worldview',
            name: 'Explicit', currentContent: 'content', parentPlane: null, sourceChapter: 5, isFoundation: true
        });
        expect(await store.isFoundationMaterial(await store.getItem('materials', 'found-exp-1'))).toBe(true);
    });
});

describe('SQLite Store - trimItemData', () => {
    test('chapter content is not truncated on setItem', async () => {
        const longContent = 'A'.repeat(5000);
        await store.setItem('chapters', 'trim-ch-1', {
            id: 'trim-ch-1', projectId: 'trim-proj', chapterNumber: 1, status: 'written',
            content: longContent
        });
        const retrieved = await store.getItem('chapters', 'trim-ch-1');
        expect(retrieved.content.length).toBe(5000);
    });

    test('writerOutput is truncated when chapter exceeds size limit', async () => {
        const longOutput = 'B'.repeat(10000);
        const longHistory = Array(50).fill({ round: 1, content: 'C'.repeat(5000) });
        await store.setItem('chapters', 'trim-ch-2', {
            id: 'trim-ch-2', projectId: 'trim-proj', chapterNumber: 2, status: 'written',
            writerOutput: longOutput, history: longHistory
        });
        const retrieved = await store.getItem('chapters', 'trim-ch-2');
        expect(retrieved.writerOutput.length).toBeLessThan(10000);
    });
});

describe('SQLite Store - queryItems', () => {
    beforeAll(async () => {
        await store.setItem('materials', 'query-m1', { id: 'query-m1', projectId: 'query-proj', type: 'character', name: 'Alice', parentPlane: null });
        await store.setItem('materials', 'query-m2', { id: 'query-m2', projectId: 'query-proj', type: 'worldview', name: 'World', parentPlane: null });
        await store.setItem('materials', 'query-m3', { id: 'query-m3', projectId: 'other-proj', type: 'character', name: 'Bob', parentPlane: null });
    });

    test('queryItems filters by projectId', async () => {
        const results = await store.queryItems('materials', { projectId: 'query-proj' });
        expect(results.length).toBe(2);
    });

    test('queryItems filters by type', async () => {
        const results = await store.queryItems('materials', { type: 'character', projectId: 'query-proj' });
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Alice');
    });

    test('queryItems returns empty for no match', async () => {
        const results = await store.queryItems('materials', { projectId: 'nonexistent' });
        expect(results.length).toBe(0);
    });
});

describe('SQLite Store - deleteItem', () => {
    test('deleteItem removes item', async () => {
        await store.setItem('projects', 'del-test-1', { id: 'del-test-1', name: 'ToDelete', mode: 'novel' });
        await store.deleteItem('projects', 'del-test-1');
        expect(await store.getItem('projects', 'del-test-1')).toBeNull();
    });

    test('deleteItem on non-existent does not throw', async () => {
        await expect(store.deleteItem('projects', 'nonexistent-del')).resolves.not.toThrow();
    });
});

describe('SQLite Store - Atomic Write Recovery', () => {
    test('setItem and getItem round-trip preserves data integrity', async () => {
        const complexData = {
            id: 'atomic-1',
            name: 'Complex Project',
            mode: 'shuangwen',
            styleProfile: { protagonistName: '测试主角', key: 'test-genre' },
            wordConfig: { target: 3000, rejectMin: 1500 },
            agentModelConfig: { writer: { provider: 'aliyunCoding', model: 'qwen3.6-plus' } },
            nested: { deep: { value: 'deep-data' } }
        };
        await store.setItem('projects', 'atomic-1', complexData);
        const retrieved = await store.getItem('projects', 'atomic-1');
        expect(retrieved.name).toBe('Complex Project');
        expect(retrieved.styleProfile.protagonistName).toBe('测试主角');
        expect(retrieved.wordConfig.target).toBe(3000);
        expect(retrieved.nested.deep.value).toBe('deep-data');
    });
});
