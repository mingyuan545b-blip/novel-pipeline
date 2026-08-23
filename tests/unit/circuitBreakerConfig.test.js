jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    listItems: jest.fn(() => []),
    queryItems: jest.fn(() => [])
}));

const store = require('../../server/store');
const { ReviewCircuitBreaker, getCircuitBreaker, DEFAULT_CONFIG } = require('../../server/services/reviewCircuitBreaker');

describe('reviewCircuitBreaker - DEFAULT_CONFIG', () => {
    test('has expected default threshold', () => {
        expect(DEFAULT_CONFIG.threshold).toBe(3);
    });

    test('has expected default cooldownMs', () => {
        expect(DEFAULT_CONFIG.cooldownMs).toBe(10 * 60 * 1000);
    });

    test('has expected default temperatureBoost', () => {
        expect(DEFAULT_CONFIG.temperatureBoost).toBeCloseTo(0.15);
    });

    test('has enablePolisher true by default', () => {
        expect(DEFAULT_CONFIG.enablePolisher).toBe(true);
    });

    test('has historyMax and historyTrimTo', () => {
        expect(DEFAULT_CONFIG.historyMax).toBe(50);
        expect(DEFAULT_CONFIG.historyTrimTo).toBe(30);
    });
});

describe('reviewCircuitBreaker - getCircuitBreaker factory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockResolvedValue(null);
        store.setItem.mockImplementation(() => {});
    });

    test('getCircuitBreaker returns a ReviewCircuitBreaker instance', () => {
        const cb = getCircuitBreaker('proj-1');
        expect(cb).toBeInstanceOf(ReviewCircuitBreaker);
    });

    test('getCircuitBreaker with project uses project config', () => {
        const project = {
            circuitBreakerConfig: { threshold: 5, cooldownMs: 999 }
        };
        const cb = getCircuitBreaker('proj-2', project);
        expect(cb.config.threshold).toBe(5);
        expect(cb.config.cooldownMs).toBe(999);
    });

    test('getCircuitBreaker without project uses DEFAULT_CONFIG', () => {
        const cb = getCircuitBreaker('proj-3');
        expect(cb.config.threshold).toBe(DEFAULT_CONFIG.threshold);
        expect(cb.config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
    });

    test('project config merges with defaults (partial override)', () => {
        const project = {
            circuitBreakerConfig: { threshold: 7 }
        };
        const cb = getCircuitBreaker('proj-4', project);
        expect(cb.config.threshold).toBe(7);
        expect(cb.config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
        expect(cb.config.temperatureBoost).toBe(DEFAULT_CONFIG.temperatureBoost);
    });
});

describe('reviewCircuitBreaker - getStats includes config', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockResolvedValue({
            id: 'proj-stats',
            projectId: 'proj-stats',
            consecutiveFailures: 2,
            lastFailureStep: 'first-review',
            tripped: false,
            tripChapter: 0,
            tripTimestamp: 0,
            history: [
                { step: 'first-review', chapterNumber: 1, result: 'fail', timestamp: new Date().toISOString() },
                { step: 'first-review', chapterNumber: 2, result: 'pass', timestamp: new Date().toISOString() }
            ],
            updatedAt: new Date().toISOString()
        });
        store.setItem.mockImplementation(() => {});
    });

    test('getStats returns config in output', async () => {
        const cb = getCircuitBreaker('proj-stats');
        const stats = await cb.getStats();
        expect(stats.config).toBeDefined();
        expect(stats.config.threshold).toBe(DEFAULT_CONFIG.threshold);
        expect(stats.config.cooldownMs).toBe(DEFAULT_CONFIG.cooldownMs);
    });

    test('getStats includes tripped and consecutiveFailures', async () => {
        const cb = getCircuitBreaker('proj-stats');
        const stats = await cb.getStats();
        expect(stats.tripped).toBe(false);
        expect(stats.consecutiveFailures).toBe(2);
    });

    test('getStats includes recentPassRate', async () => {
        const cb = getCircuitBreaker('proj-stats');
        const stats = await cb.getStats();
        expect(stats.recentPassRate).toBeDefined();
        expect(typeof stats.recentPassRate).toBe('string');
    });

    test('getStats with project config reflects project config', async () => {
        const project = { circuitBreakerConfig: { threshold: 10 } };
        const cb = getCircuitBreaker('proj-stats', project);
        const stats = await cb.getStats();
        expect(stats.config.threshold).toBe(10);
    });
});

describe('reviewCircuitBreaker - environment variable overrides', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        store.getItem.mockResolvedValue(null);
        store.setItem.mockImplementation(() => {});
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    test('CB_THRESHOLD env var overrides default threshold', () => {
        process.env.CB_THRESHOLD = '7';
        const { DEFAULT_CONFIG: freshConfig } = require('../../server/services/reviewCircuitBreaker');
        expect(freshConfig.threshold).toBe(7);
    });

    test('CB_COOLDOWN_MS env var overrides default cooldown', () => {
        process.env.CB_COOLDOWN_MS = '300000';
        const { DEFAULT_CONFIG: freshConfig } = require('../../server/services/reviewCircuitBreaker');
        expect(freshConfig.cooldownMs).toBe(300000);
    });

    test('invalid CB_THRESHOLD fall back to default', () => {
        process.env.CB_THRESHOLD = 'not-a-number';
        const { DEFAULT_CONFIG: freshConfig } = require('../../server/services/reviewCircuitBreaker');
        expect(freshConfig.threshold).toBe(3);
    });

    test('invalid CB_COOLDOWN_MS fall back to default', () => {
        process.env.CB_COOLDOWN_MS = 'abc';
        const { DEFAULT_CONFIG: freshConfig } = require('../../server/services/reviewCircuitBreaker');
        expect(freshConfig.cooldownMs).toBe(10 * 60 * 1000);
    });
});

describe('reviewCircuitBreaker - recordFailure and trip', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockResolvedValue({
            id: 'proj-fail',
            projectId: 'proj-fail',
            consecutiveFailures: 0,
            lastFailureStep: '',
            tripped: false,
            tripChapter: 0,
            tripTimestamp: 0,
            history: [],
            updatedAt: new Date().toISOString()
        });
        store.setItem.mockImplementation(() => {});
    });

    test('recordFailure increments consecutiveFailures', async () => {
        const cb = getCircuitBreaker('proj-fail');
        await cb.recordFailure('first-review', 1);
        expect(store.setItem).toHaveBeenCalled();
        const savedData = store.setItem.mock.calls[0][2];
        expect(savedData.consecutiveFailures).toBe(1);
    });

    test('circuit trips after reaching threshold', async () => {
        const cb = getCircuitBreaker('proj-fail');
        await cb.recordFailure('first-review', 1);
        await cb.recordFailure('first-review', 2);
        await cb.recordFailure('first-review', 3);
        const lastSave = store.setItem.mock.calls[store.setItem.mock.calls.length - 1][2];
        expect(lastSave.tripped).toBe(true);
        expect(lastSave.tripChapter).toBe(3);
    });

    test('history is trimmed when exceeding historyMax', async () => {
        const longHistory = Array.from({ length: 55 }, (_, i) => ({
            step: 'first-review', chapterNumber: i + 1, result: 'fail', timestamp: new Date().toISOString()
        }));
        store.getItem.mockResolvedValue({
            id: 'proj-trim',
            projectId: 'proj-trim',
            consecutiveFailures: 55,
            lastFailureStep: 'first-review',
            tripped: true,
            tripChapter: 3,
            tripTimestamp: Date.now() - 60000,
            history: longHistory,
            updatedAt: new Date().toISOString()
        });
        const cb = getCircuitBreaker('proj-trim');
        await cb.recordFailure('first-review', 56);
        const savedData = store.setItem.mock.calls[0][2];
        expect(savedData.history.length).toBeLessThanOrEqual(DEFAULT_CONFIG.historyTrimTo + 1);
    });
});

describe('reviewCircuitBreaker - recordSuccess resets failures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.getItem.mockResolvedValue({
            id: 'proj-success',
            projectId: 'proj-success',
            consecutiveFailures: 2,
            lastFailureStep: 'first-review',
            tripped: false,
            tripChapter: 0,
            tripTimestamp: 0,
            history: [],
            updatedAt: new Date().toISOString()
        });
        store.setItem.mockImplementation(() => {});
    });

    test('recordSuccess resets consecutiveFailures when not tripped', async () => {
        const cb = getCircuitBreaker('proj-success');
        await cb.recordSuccess(3);
        const savedData = store.setItem.mock.calls[0][2];
        expect(savedData.consecutiveFailures).toBe(0);
    });

    test('recordSuccess adds pass entry to history', async () => {
        const cb = getCircuitBreaker('proj-success');
        await cb.recordSuccess(3);
        const savedData = store.setItem.mock.calls[0][2];
        const passEntries = savedData.history.filter(h => h.result === 'pass');
        expect(passEntries.length).toBe(1);
    });
});

describe('reviewCircuitBreaker - getAdjustedConfig', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns no boost when not tripped', async () => {
        store.getItem.mockResolvedValue({
            id: 'proj-adj',
            projectId: 'proj-adj',
            consecutiveFailures: 1,
            lastFailureStep: 'first-review',
            tripped: false,
            tripChapter: 0,
            tripTimestamp: 0,
            history: [],
            updatedAt: new Date().toISOString()
        });
        store.setItem.mockImplementation(() => {});
        const cb = getCircuitBreaker('proj-adj');
        const adjusted = await cb.getAdjustedConfig();
        expect(adjusted.temperatureBoost).toBe(0);
        expect(adjusted.enablePolisher).toBe(false);
        expect(adjusted.message).toBe('');
    });

    test('returns boost config when tripped', async () => {
        store.getItem.mockResolvedValue({
            id: 'proj-adj2',
            projectId: 'proj-adj2',
            consecutiveFailures: 3,
            lastFailureStep: 'first-review',
            tripped: true,
            tripChapter: 5,
            tripTimestamp: Date.now(),
            history: [],
            updatedAt: new Date().toISOString()
        });
        store.setItem.mockImplementation(() => {});
        const cb = getCircuitBreaker('proj-adj2');
        const adjusted = await cb.getAdjustedConfig();
        expect(adjusted.temperatureBoost).toBe(DEFAULT_CONFIG.temperatureBoost);
        expect(adjusted.enablePolisher).toBe(DEFAULT_CONFIG.enablePolisher);
        expect(adjusted.message).toContain('熔断');
    });
});
