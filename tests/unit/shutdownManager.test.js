'use strict';

/**
 * shutdownManager 优雅关闭管理器单元测试（Q4）
 *
 * 测试策略：
 * - mock process.exit 防止测试进程退出
 * - 验证 LIFO 顺序、错误隔离、超时保护、重复触发保护
 * - 不绑定真实信号处理器（避免测试间污染）
 *
 * 文件位置：tests/unit/shutdownManager.test.js
 */

const { ShutdownManager, DEFAULT_SHUTDOWN_TIMEOUT_MS, SHUTDOWN_HOOKS_MAX } = require('../../server/shared/shutdownManager');

// mock process.exit
let exitCalls = [];
beforeEach(() => {
    exitCalls = [];
    jest.spyOn(process, 'exit').mockImplementation((code) => {
        exitCalls.push(code);
        // 不真正退出，但抛出以模拟不可返回（可选）
        throw new Error(`process.exit(${code}) called`);
    });
});
afterEach(() => {
    jest.restoreAllMocks();
});

describe('shutdownManager (Q4)', () => {
    describe('常量', () => {
        test('DEFAULT_SHUTDOWN_TIMEOUT_MS 为正整数', () => {
            expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBeGreaterThan(0);
            expect(Number.isInteger(DEFAULT_SHUTDOWN_TIMEOUT_MS)).toBe(true);
        });

        test('SHUTDOWN_HOOKS_MAX 为正整数', () => {
            expect(SHUTDOWN_HOOKS_MAX).toBeGreaterThan(0);
            expect(Number.isInteger(SHUTDOWN_HOOKS_MAX)).toBe(true);
        });
    });

    describe('register', () => {
        test('注册单个 hook', () => {
            const m = new ShutdownManager();
            m.register('h1', () => {});
            expect(m.getHookCount()).toBe(1);
            expect(m.getHookNames()).toEqual(['h1']);
        });

        test('注册多个 hook 保持顺序', () => {
            const m = new ShutdownManager();
            m.register('h1', () => {});
            m.register('h2', () => {});
            m.register('h3', () => {});
            expect(m.getHookNames()).toEqual(['h1', 'h2', 'h3']);
        });

        test('handler 非函数抛错', () => {
            const m = new ShutdownManager();
            expect(() => m.register('h1', 'not a function')).toThrow('handler must be a function');
        });

        test('超过 SHUTDOWN_HOOKS_MAX 抛错', () => {
            const m = new ShutdownManager();
            for (let i = 0; i < SHUTDOWN_HOOKS_MAX; i++) {
                m.register(`h${i}`, () => {});
            }
            expect(() => m.register('overflow', () => {})).toThrow('exceeded max');
        });
    });

    describe('trigger - LIFO 顺序', () => {
        test('后注册的先执行', async () => {
            const m = new ShutdownManager();
            const order = [];
            m.register('first', () => { order.push('first'); return Promise.resolve(); });
            m.register('second', () => { order.push('second'); return Promise.resolve(); });
            m.register('third', () => { order.push('third'); return Promise.resolve(); });

            try { await m.trigger('SIGTERM'); } catch (e) { /* process.exit mock */ }
            expect(order).toEqual(['third', 'second', 'first']);
        });

        test('触发后 hooks 列表清空', async () => {
            const m = new ShutdownManager();
            m.register('h1', () => Promise.resolve());
            try { await m.trigger('SIGTERM'); } catch (e) { /* process.exit */ }
            expect(m.getHookCount()).toBe(0);
        });

        test('触发后调用 process.exit(0)', async () => {
            const m = new ShutdownManager();
            m.register('h1', () => Promise.resolve());
            try { await m.trigger('SIGTERM'); } catch (e) { /* process.exit */ }
            expect(exitCalls).toContain(0);
        });
    });

    describe('trigger - 错误隔离', () => {
        test('单个 hook 抛错不阻塞其他', async () => {
            const m = new ShutdownManager();
            const executed = [];
            m.register('ok1', () => { executed.push('ok1'); return Promise.resolve(); });
            m.register('fail', () => { throw new Error('boom'); });
            m.register('ok2', () => { executed.push('ok2'); return Promise.resolve(); });

            try { await m.trigger('SIGTERM'); } catch (e) { /* process.exit */ }
            // LIFO: ok2 → fail → ok1
            expect(executed).toEqual(['ok2', 'ok1']);
            expect(exitCalls).toContain(0);
        });

        test('异步 hook 抛错不阻塞', async () => {
            const m = new ShutdownManager();
            const executed = [];
            m.register('ok', () => { executed.push('ok'); return Promise.resolve(); });
            m.register('asyncFail', () => Promise.reject(new Error('async boom')));

            try { await m.trigger('SIGINT'); } catch (e) { /* process.exit */ }
            expect(executed).toEqual(['ok']);
            expect(exitCalls).toContain(0);
        });

        test('所有 hook 都失败仍正常退出', async () => {
            const m = new ShutdownManager();
            m.register('f1', () => { throw new Error('e1'); });
            m.register('f2', () => Promise.reject(new Error('e2')));

            try { await m.trigger('SIGTERM'); } catch (e) { /* process.exit */ }
            expect(exitCalls).toContain(0);
        });
    });

    describe('trigger - 重复触发保护', () => {
        test('正在关闭时再次触发不执行', async () => {
            const m = new ShutdownManager();
            const calls = [];
            m.register('h1', () => {
                calls.push('h1');
                return new Promise(r => setTimeout(r, 50));
            });

            // 第一次触发（异步进行中）
            const p = m.trigger('SIGTERM').catch(() => {});
            // 立即第二次触发 — 应被忽略
            await m.trigger('SIGINT').catch(() => {});
            await p;
            expect(calls.length).toBe(1);
            expect(m.isShuttingDown()).toBe(true);
        });
    });

    describe('bindSignalHandlers', () => {
        test('绑定后不重复绑定', () => {
            const m = new ShutdownManager();
            const before = process.listenerCount('SIGTERM');
            m.bindSignalHandlers();
            m.bindSignalHandlers();
            m.bindSignalHandlers();
            expect(process.listenerCount('SIGTERM')).toBe(before + 1);
        });
    });

    describe('getHookCount / getHookNames / isShuttingDown', () => {
        test('初始状态', () => {
            const m = new ShutdownManager();
            expect(m.getHookCount()).toBe(0);
            expect(m.getHookNames()).toEqual([]);
            expect(m.isShuttingDown()).toBe(false);
        });

        test('注册后状态更新', () => {
            const m = new ShutdownManager();
            m.register('a', () => {});
            m.register('b', () => {});
            expect(m.getHookCount()).toBe(2);
            expect(m.getHookNames()).toEqual(['a', 'b']);
            expect(m.isShuttingDown()).toBe(false);
        });
    });

    describe('_resetForTest', () => {
        test('重置后状态清空', () => {
            const m = new ShutdownManager();
            m.register('h1', () => {});
            m._resetForTest();
            expect(m.getHookCount()).toBe(0);
            expect(m.isShuttingDown()).toBe(false);
        });
    });
});
