const { acquireLock, releaseLock } = require('../../server/db/storeLock');

describe('storeLock', () => {
    it('should acquire and release lock without error', async () => {
        await acquireLock('test-type', 'test-id');
        releaseLock('test-type', 'test-id');
    });

    it('should allow sequential lock acquire/release', async () => {
        await acquireLock('test-type', 'seq-1');
        releaseLock('test-type', 'seq-1');
        await acquireLock('test-type', 'seq-1');
        releaseLock('test-type', 'seq-1');
    });

    it('should handle concurrent lock requests sequentially', async () => {
        const results = [];
        const tasks = [1, 2, 3].map(n => (async () => {
            await acquireLock('test-type', 'concurrent-1');
            results.push(n);
            releaseLock('test-type', 'concurrent-1');
        })());
        await Promise.all(tasks);
        expect(results.length).toBe(3);
    });

    it('should handle different keys independently', async () => {
        await acquireLock('test-type', 'key-a');
        await acquireLock('test-type', 'key-b');
        releaseLock('test-type', 'key-a');
        releaseLock('test-type', 'key-b');
    });
});
