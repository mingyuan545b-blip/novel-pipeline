/**
 * pipelineUtils.test.js
 * 覆盖 checkAlertLoop, runBranchingWrite
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../server/services/metricsCollector', () => ({
    getMetrics: jest.fn()
}));

jest.mock('../../server/services/reviewCircuitBreaker', () => ({
    getCircuitBreaker: jest.fn()
}));

jest.mock('../../server/services/versionControl', () => ({
    createVersionTag: jest.fn()
}));

jest.mock('../../server/config', () => ({
    resolveConfig: jest.fn()
}));

jest.mock('../../server/services/genreConfig', () => ({
    resolveGenreFromProject: jest.fn()
}));

jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

jest.mock('../../server/services/pipelineConfig', () => ({
    PIPELINE_CONFIG: {
        ALERT_CONSECUTIVE_CHAPTERS: 3,
        ALERT_FAIL_RATE_THRESHOLD: 0.5,
        BRANCHING_TEMPERATURE_BOOST: 0.2,
        BRANCHING_MAX_TEMPERATURE: 1.0
    }
}));

const { getMetrics } = require('../../server/services/metricsCollector');
const { getCircuitBreaker } = require('../../server/services/reviewCircuitBreaker');
const { resolveConfig } = require('../../server/config');
const { resolveGenreFromProject } = require('../../server/services/genreConfig');
const { getDataContext } = require('../../server/services/dataContext');
const { checkAlertLoop, runBranchingWrite } = require('../../server/services/pipeline/pipelineUtils');

describe('pipelineUtils', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('checkAlertLoop', () => {
        test('returns null when no report', async () => {
            const mockMetrics = { getReport: jest.fn().mockResolvedValue(null) };
            getMetrics.mockReturnValue(mockMetrics);
            const result = await checkAlertLoop('proj1');
            expect(result).toBeNull();
        });

        test('returns null when no agentPassRates', async () => {
            const mockMetrics = { getReport: jest.fn().mockResolvedValue({}) };
            getMetrics.mockReturnValue(mockMetrics);
            const result = await checkAlertLoop('proj1');
            expect(result).toBeNull();
        });

        test('returns null when fail rate below threshold', async () => {
            const mockMetrics = {
                getReport: jest.fn().mockResolvedValue({
                    agentPassRates: { writer: { total: 10, passed: 9, recentFailChapters: [] } }
                })
            };
            getMetrics.mockReturnValue(mockMetrics);
            const result = await checkAlertLoop('proj1');
            expect(result).toBeNull();
        });

        test('returns diagnostic when fail rate exceeds threshold', async () => {
            const mockMetrics = {
                getReport: jest.fn().mockResolvedValue({
                    agentPassRates: { writer: { total: 10, passed: 3, recentFailChapters: ['ch1'] } }
                })
            };
            getMetrics.mockReturnValue(mockMetrics);
            const mockCB = { getStats: jest.fn().mockReturnValue({ tripped: false }) };
            getCircuitBreaker.mockReturnValue(mockCB);

            const result = await checkAlertLoop('proj1');
            expect(result.triggered).toBe(true);
            expect(result.alerts.length).toBeGreaterThan(0);
            expect(result.suggestions.length).toBeGreaterThan(0);
        });

        test('includes circuit breaker suggestion when tripped', async () => {
            const mockMetrics = {
                getReport: jest.fn().mockResolvedValue({
                    agentPassRates: { 'first-review': { total: 10, passed: 2, recentFailChapters: [] } }
                })
            };
            getMetrics.mockReturnValue(mockMetrics);
            const mockCB = { getStats: jest.fn().mockReturnValue({ tripped: true }) };
            getCircuitBreaker.mockReturnValue(mockCB);

            const result = await checkAlertLoop('proj1');
            expect(result.suggestions.some(s => s.includes('熔断器'))).toBe(true);
        });

        test('skips agents with too few samples', async () => {
            const mockMetrics = {
                getReport: jest.fn().mockResolvedValue({
                    agentPassRates: { writer: { total: 2, passed: 0, recentFailChapters: [] } }
                })
            };
            getMetrics.mockReturnValue(mockMetrics);
            const result = await checkAlertLoop('proj1');
            expect(result).toBeNull();
        });

        test('handles circuit breaker error gracefully', async () => {
            const mockMetrics = {
                getReport: jest.fn().mockResolvedValue({
                    agentPassRates: { writer: { total: 10, passed: 2, recentFailChapters: [] } }
                })
            };
            getMetrics.mockReturnValue(mockMetrics);
            getCircuitBreaker.mockImplementation(() => { throw new Error('CB error'); });

            const result = await checkAlertLoop('proj1');
            expect(result.triggered).toBe(true);
            expect(result.circuitBreakerStatus).toBeNull();
        });
    });

    describe('runBranchingWrite', () => {
        const mockRunAgent = jest.fn();
        const mockProject = { genre: 'novel' };
        const mockBranchCtx = { getProject: jest.fn().mockResolvedValue(mockProject) };

        beforeEach(() => {
            mockRunAgent.mockReset();
            getDataContext.mockResolvedValue(mockBranchCtx);
            resolveGenreFromProject.mockReturnValue('novel');
            resolveConfig.mockReturnValue({ word: { targetMin: 2000, maxChapter: 5000 } });
        });

        test('selects branch A when only A in range', async () => {
            mockRunAgent
                .mockResolvedValueOnce({ response: 'A'.repeat(3000) })
                .mockResolvedValueOnce({ response: 'B'.repeat(500) });

            const result = await runBranchingWrite('proj1', 'ch1', { chapterNumber: 1 }, {}, mockRunAgent);
            expect(result.selectedBranch).toBe('A');
        });

        test('selects branch B when only B in range', async () => {
            mockRunAgent
                .mockResolvedValueOnce({ response: 'A'.repeat(500) })
                .mockResolvedValueOnce({ response: 'B'.repeat(3000) });

            const result = await runBranchingWrite('proj1', 'ch1', { chapterNumber: 1 }, {}, mockRunAgent);
            expect(result.selectedBranch).toBe('B');
        });

        test('selects closer to target when both in range', async () => {
            mockRunAgent
                .mockResolvedValueOnce({ response: 'A'.repeat(3000) })
                .mockResolvedValueOnce({ response: 'B'.repeat(4500) });

            const result = await runBranchingWrite('proj1', 'ch1', { chapterNumber: 1 }, {}, mockRunAgent);
            expect(result.selectedBranch).toBe('A');
        });

        test('selects longer when neither in range', async () => {
            mockRunAgent
                .mockResolvedValueOnce({ response: 'A'.repeat(500) })
                .mockResolvedValueOnce({ response: 'B'.repeat(800) });

            const result = await runBranchingWrite('proj1', 'ch1', { chapterNumber: 1 }, {}, mockRunAgent);
            expect(result.selectedBranch).toBe('B');
        });
    });
});
