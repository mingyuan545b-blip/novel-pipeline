/**
 * 回归测试：
 *   1) shared/runContext 相对轮次换算与并发隔离
 *   2) store.setItem 在流水线运行上下文内为 reviews 补 runRound（单点收敛，覆盖 14 处写入点）
 * 背景：reviews 只记了跨运行累计的 round，前端"执行日志"显示 R3/R5/R6 且缺 R1/R2。
 */
process.env.USE_PG = 'true';

jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../server/db/pgPool', () => ({ initPgPool: jest.fn(), healthCheck: jest.fn(async () => ({ status: 'ok' })) }));
jest.mock('../../server/db/database-pg', () => ({ initDatabaseAsync: jest.fn() }));

const written = [];
jest.mock('../../server/db/store-pg', () => ({
    setItem: jest.fn(async (type, id, data) => { written.push({ type, id, data }); return data; }),
    listItems: jest.fn(async () => []),
    getItem: jest.fn(async () => null),
    deleteItem: jest.fn(async () => true),
    queryItems: jest.fn(async () => []),
    updateItem: jest.fn(),
    isFoundationMaterial: jest.fn(async () => false)
}));

const { runWithContext, toRunRound, getRunContext } = require('../../server/shared/runContext');
const store = require('../../server/store');

describe('shared/runContext', () => {
    test('无上下文时 toRunRound 返回 undefined（路由/脚本手工写入不受影响）', () => {
        expect(getRunContext()).toBeUndefined();
        expect(toRunRound(3)).toBeUndefined();
    });

    test('上下文内换算相对轮次', async () => {
        await runWithContext({ startRound: 3 }, () => {
            expect(toRunRound(3)).toBe(1);
            expect(toRunRound(5)).toBe(3);
            expect(toRunRound(2)).toBeUndefined(); // 早于本次运行的轮次
        });
    });

    test('并发运行之间上下文隔离', async () => {
        const out = await Promise.all([
            runWithContext({ startRound: 1 }, async () => { await new Promise(r => setTimeout(r, 5)); return toRunRound(2); }),
            runWithContext({ startRound: 10 }, async () => { await new Promise(r => setTimeout(r, 1)); return toRunRound(2); })
        ]);
        expect(out).toEqual([2, undefined]);
    });
});

describe('store.setItem 为 reviews 补 runRound', () => {
    // 首次 getBackend() 会触发 JSON→PG 的历史数据同步，会往 written 里塞大量无关行；
    // 先预热一次后端，让后续断言只看本次写入
    beforeAll(async () => { await store.ensureBackend(); });

    test('流水线上下文内写入的 review 会被补上 runRound', async () => {
        written.length = 0;
        await runWithContext({ startRound: 3 }, () =>
            store.setItem('reviews', 'r1', { id: 'r1', type: 'first-review', round: 4 }));
        expect(written[0].data.runRound).toBe(2);
    });

    test('上下文外写入的 review 不补 runRound（保持原行为）', async () => {
        written.length = 0;
        await store.setItem('reviews', 'r2', { id: 'r2', type: 'first-review', round: 4 });
        expect(written[0].data.runRound).toBeUndefined();
    });

    test('非 reviews 类型不受影响', async () => {
        written.length = 0;
        await runWithContext({ startRound: 1 }, () => store.setItem('chapters', 'c1', { id: 'c1', round: 9 }));
        expect(written[0].data.runRound).toBeUndefined();
    });
});
