'use strict';

/**
 * loggerSetup 测试 —— 回归：setupLoggerChain 必须把 debugPersister 交出去
 *
 * 背景（2026-10-01 排查服务器启动日志时发现）：
 *   server/index.js 写的是
 *     const { alertEngine, fallbackCleanupTimer, debugPersister } = setupLoggerChain();
 *   而 setupLoggerChain 曾经**不返回 debugPersister** → 解构得到 undefined →
 *     debugPersister.attachPool(pgPool) 抛 "Cannot read properties of undefined (reading 'attachPool')"
 *   被 index.js 的 try/catch 吞掉，于是同一 try 块里的 DEBUG-PERSIST 与
 *   AUDIT-PERSIST（审计日志入库）一起被跳过，且 shutdownHooks 注册的
 *   debugPersister.stop() 在关闭时抛错（该步被 shutdownManager 单独 catch，静默失效）。
 *   表现：调试日志只落 fallback 文件不入库、告警与审计日志不入库 —— 静默降级。
 *
 * 说明：server 侧用 NODE_PATH=server 解析 `shared/*` 裸标识符，jest 默认解析不到。
 *   这里统一用 { virtual: true } 注入 mock，避免改 jest.config（全局配置需先确认）。
 *
 * 文件位置：tests/unit/loggerSetup.test.js
 */

const V = { virtual: true };

jest.mock('shared/logger', () => ({
    attachLogStore: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn(),
}), V);

jest.mock('shared/logStore', () => ({
    logStore: { name: 'logStore' }, attachAggregator: jest.fn(), attachPersister: jest.fn(),
}), V);

jest.mock('shared/logAggregator', () => ({ logAggregator: { name: 'aggregator' } }), V);

const mockDebugPersister = {
    name: 'debugPersister',
    attachPool: jest.fn(), start: jest.fn(), stop: jest.fn(), attachFallbackWriter: jest.fn(),
};
jest.mock('shared/debugPersister', () => ({ debugPersister: mockDebugPersister }), V);

jest.mock('shared/debugFallbackWriter', () => ({
    DebugFallbackWriter: class { cleanup() { return 0; } },
}), V);

jest.mock('shared/shutdownManager', () => ({
    shutdownManager: { bindSignalHandlers: jest.fn() },
}), V);

jest.mock('shared/auditLogStore', () => ({
    auditLogStore: { setFallbackDir: jest.fn() },
}), V);

const mockAlertEngine = {
    name: 'alertEngine', attachAggregator: jest.fn(), attachPersister: jest.fn(), start: jest.fn(),
};
jest.mock('shared/alertRules', () => ({ alertEngine: mockAlertEngine }), V);

jest.mock('../../server/config/systemConfigDefs', () => ({
    DEBUG_FALLBACK: { CLEANUP_INTERVAL_MS: 60000 },
}));

const { setupLoggerChain } = require('../../server/bootstrap/loggerSetup');
const { attachPersister } = require('shared/logStore');
const logger = require('shared/logger');

describe('setupLoggerChain（logger 注入链）', () => {
    let result;

    beforeAll(() => {
        jest.useFakeTimers();
        result = setupLoggerChain();
    });

    afterAll(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('必须返回 debugPersister —— index.js 的解构依赖它，缺了会静默降级整条持久化链', () => {
        expect(result.debugPersister).toBeDefined();
        expect(result.debugPersister).toBe(mockDebugPersister);
    });

    test('返回的 debugPersister 与实际被 attach 的持久化器是同一个单例', () => {
        expect(attachPersister).toHaveBeenCalledWith(mockDebugPersister);
        expect(result.debugPersister).toBe(attachPersister.mock.calls[0][0]);
    });

    test('index.js 用到的其余键也都在（alertEngine / fallbackWriter / fallbackCleanupTimer）', () => {
        expect(result.alertEngine).toBe(mockAlertEngine);
        expect(result.fallbackWriter).toBeDefined();
        expect(result.fallbackCleanupTimer).toBeDefined();
    });

    test('注入链完整：logStore/aggregator/persister/fallbackWriter/alertEngine 全部接上', () => {
        expect(logger.attachLogStore).toHaveBeenCalled();
        expect(mockDebugPersister.attachFallbackWriter).toHaveBeenCalled();
        expect(mockAlertEngine.attachAggregator).toHaveBeenCalled();
        expect(mockAlertEngine.attachPersister).toHaveBeenCalledWith(mockDebugPersister);
        expect(mockAlertEngine.start).toHaveBeenCalled();
    });
});
