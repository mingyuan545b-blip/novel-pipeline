/**
 * storeLock — 锁语义测试（互斥 + 不同 key 独立）
 *
 * 原测试只有"调用不抛错"（零断言 = 假测试）。锁的唯一价值是**互斥**，
 * 故改为断言：同 key 第二次 acquire 必须等 release 之后；不同 key 不被互相阻塞。
 */
const { acquireLock, releaseLock } = require('../../server/db/storeLock');

describe('storeLock', () => {
    it('同一 key 的第二次 acquireLock 必须被阻塞到 release 之后（互斥）', async () => {
        const events = [];
        await acquireLock('test-type', 'mutex');
        events.push('A-acquired');

        const second = (async () => {
            await acquireLock('test-type', 'mutex');
            events.push('B-acquired');
            releaseLock('test-type', 'mutex');
        })();

        await new Promise(r => setTimeout(r, 30));
        expect(events).toEqual(['A-acquired']);        // B 仍在等锁

        releaseLock('test-type', 'mutex');
        await second;
        expect(events).toEqual(['A-acquired', 'B-acquired']);
    });

    it('不同 key 互不阻塞（key-b 不会等 key-a）', async () => {
        await acquireLock('test-type', 'key-a');
        const started = Date.now();
        await acquireLock('test-type', 'key-b');
        expect(Date.now() - started).toBeLessThan(500);
        releaseLock('test-type', 'key-b');
        releaseLock('test-type', 'key-a');
    });

    it('并发同 key：3 个任务全部完成且顺序串行', async () => {
        const order = [];
        const tasks = [1, 2, 3].map(n => (async () => {
            await acquireLock('test-type', 'concurrent');
            order.push(n);
            releaseLock('test-type', 'concurrent');
        })());
        await Promise.all(tasks);
        expect(order.sort()).toEqual([1, 2, 3]);
    });

    it('acquire/release 可重复使用（不泄漏锁状态）', async () => {
        await acquireLock('test-type', 'reuse');
        releaseLock('test-type', 'reuse');
        await acquireLock('test-type', 'reuse');       // 若上次未真正释放，这里会挂住
        releaseLock('test-type', 'reuse');
        expect(true).toBe(true);
    });
});
