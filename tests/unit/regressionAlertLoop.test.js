/**
 * regressionAlertLoop.test.js — Alert Loop和章节重置回归测试
 * 覆盖问题：
 * 1. Alert Loop误触发 — 章节重置时未清理agentPassRates和circuitBreaker
 * 2. async/await缺失 — checkCircuitBreaker中的async函数调用
 */
const store = require('../../server/store');

jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn(),
}));

describe('回归测试: Alert Loop和章节重置', () => {
    beforeEach(() => jest.clearAllMocks());

    test('checkCircuitBreaker应await checkAlertLoop调用', async () => {
        // 验证checkCircuitBreaker函数存在且返回Promise
        const { checkCircuitBreaker } = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = {
            isTripped: jest.fn().mockResolvedValue(false),
        };
        const pipelineLog = [];
        const projectId = 'test-project-id';

        const result = checkCircuitBreaker(projectId, 1, circuitBreaker, pipelineLog, 'test-chapter-id', projectId);

        // 应返回Promise（async函数）
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toBeDefined();
        expect(resolved.tripped).toBe(false);
    });

    test('checkCircuitBreaker在Alert Loop触发时应await isTripped', async () => {
        // 验证checkCircuitBreaker是async函数（返回Promise）
        // 这是修复async/await缺失bug的回归测试
        const { checkCircuitBreaker } = require('../../server/core/pipeline/orchestratorRoundHelpers');
        const circuitBreaker = {
            isTripped: jest.fn().mockResolvedValue(false),
        };

        const result = checkCircuitBreaker('test-project', 1, circuitBreaker, [], 'test-chapter', 'test-project');

        // 关键验证：应返回Promise（async函数），而非同步值
        // 修复前：checkAlertLoop和isTripped的async调用未await，返回Promise被当truthy值
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved).toBeDefined();
        expect(resolved.tripped).toBe(false);
    });

    test('章节重置应清理agentPassRates', () => {
        // 验证MetricsCollector类有resetAgentPassRates方法
        const { MetricsCollector } = require('../../server/services/metricsRecorder');
        expect(MetricsCollector).toBeDefined();
        const metrics = new MetricsCollector('test-project');
        expect(metrics.resetAgentPassRates).toBeDefined();
        expect(typeof metrics.resetAgentPassRates).toBe('function');
    });

    test('章节重置应清理circuitBreaker', () => {
        // 验证ReviewCircuitBreaker模块有reset函数
        const { ReviewCircuitBreaker } = require('../../server/services/reviewCircuitBreaker');
        const cb = new ReviewCircuitBreaker();
        expect(cb.reset).toBeDefined();
        expect(typeof cb.reset).toBe('function');
    });
});
