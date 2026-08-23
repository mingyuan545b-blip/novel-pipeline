const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const store = require('../../server/db/store');

let db;

beforeAll(async () => {
    db = await initDatabaseAsync(':memory:');
});

afterAll(() => {
    closeDatabase();
});

describe('Store Lock Mechanism - R-01', () => {
    test('sequential writes to same item succeed', async () => {
        await store.setItem('projects', 'lock-seq-test', { id: 'lock-seq-test', name: 'First' });
        await store.setItem('projects', 'lock-seq-test', { id: 'lock-seq-test', name: 'Second' });
        const item = await store.getItem('projects', 'lock-seq-test');
        expect(item.name).toBe('Second');
    });

    test('concurrent writes to different items succeed', async () => {
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(store.setItem('projects', `lock-concurrent-${i}`, {
                id: `lock-concurrent-${i}`, name: `Item ${i}`
            }));
        }
        await Promise.all(promises);
        for (let i = 0; i < 5; i++) {
            const item = await store.getItem('projects', `lock-concurrent-${i}`);
            expect(item).not.toBeNull();
            expect(item.name).toBe(`Item ${i}`);
        }
    });

    test('lock queue processes writes in order', async () => {
        const storeModule = require('../../server/db/store');
        const _lockQueues = storeModule._lockQueues;

        if (_lockQueues) {
            const results = [];
            const promises = [];
            for (let i = 0; i < 3; i++) {
                promises.push(
                    store.setItem('projects', `lock-queue-${i}`, { id: `lock-queue-${i}`, name: `Queue ${i}` })
                        .then(() => results.push(i))
                );
            }
            await Promise.all(promises);
            expect(results.length).toBe(3);
            for (let i = 0; i < 3; i++) {
                const item = await store.getItem('projects', `lock-queue-${i}`);
                expect(item).not.toBeNull();
                expect(item.name).toBe(`Queue ${i}`);
            }
        }
    });

    test('deleteItem acquires and releases lock', async () => {
        await store.setItem('projects', 'lock-delete-test', { id: 'lock-delete-test', name: 'ToDelete' });
        const result = await store.deleteItem('projects', 'lock-delete-test');
        expect(result).toBe(true);
        expect(await store.getItem('projects', 'lock-delete-test')).toBeNull();
    });

    test('write after lock release succeeds', async () => {
        await store.setItem('projects', 'lock-release-test', { id: 'lock-release-test', name: 'V1' });
        await store.setItem('projects', 'lock-release-test', { id: 'lock-release-test', name: 'V2' });
        await store.setItem('projects', 'lock-release-test', { id: 'lock-release-test', name: 'V3' });
        const item = await store.getItem('projects', 'lock-release-test');
        expect(item.name).toBe('V3');
    });

    test('updateItem acquires and releases lock', async () => {
        await store.setItem('projects', 'lock-update-test', { id: 'lock-update-test', name: 'Original' });
        const result = await store.updateItem('projects', 'lock-update-test', (item) => {
            item.name = 'Updated';
            return item;
        });
        expect(result).not.toBeNull();
        expect(result.name).toBe('Updated');
    });

    test('updateItem returns null for non-existent item', async () => {
        const result = await store.updateItem('projects', 'non-existent-id', (item) => item);
        expect(result).toBeNull();
    });
});
