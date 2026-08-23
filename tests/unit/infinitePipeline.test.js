/**
 * infinitePipeline stateManager tests
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
    queryItems: jest.fn(),
    listItems: jest.fn()
}));

const store = require('../../server/store');
const { getInfinitePipelineStatus, forceResetPipeline, INFINITE_PIPELINE_STATE, getActiveCount, cleanupStaleStateEntries } = require('../../server/services/pipeline/infinite/stateManager');

describe('infinitePipeline stateManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(INFINITE_PIPELINE_STATE).forEach(k => delete INFINITE_PIPELINE_STATE[k]);
    });

    describe('getInfinitePipelineStatus', () => {
        it('should return running:false when no state exists', async () => {
            store.getItem.mockResolvedValue(null);
            const result = await getInfinitePipelineStatus('p-noexist');
            expect(result.running).toBe(false);
        });

        it('should return status from persisted state', async () => {
            store.getItem.mockResolvedValue({
                running: true, stopped: false, currentChapter: 5,
                completedChapters: 4, supplementCount: 1, phase: 'executing',
                batchProgress: '5/20', logs: [{ msg: 'test' }]
            });
            const result = await getInfinitePipelineStatus('p1');
            expect(result.running).toBe(true);
            expect(result.currentChapter).toBe(5);
            expect(result.completedChapters).toBe(4);
        });

        it('should return status from in-memory state', async () => {
            INFINITE_PIPELINE_STATE['p1'] = {
                running: true, stopped: false, currentChapter: 3,
                completedChapters: 2, supplementCount: 0, phase: 'executing',
                batchProgress: '', lastError: null, logs: []
            };
            const result = await getInfinitePipelineStatus('p1');
            expect(result.running).toBe(true);
            expect(result.currentChapter).toBe(3);
        });
    });

    describe('forceResetPipeline', () => {
        it('should clear in-memory state and reset persisted state', async () => {
            INFINITE_PIPELINE_STATE['p1'] = { running: true, _clearHeartbeat: jest.fn() };
            store.getItem.mockResolvedValue({ running: true, stopped: false });
            store.setItem.mockResolvedValue({});
            store.queryItems.mockResolvedValue([]);
            store.deleteItem.mockResolvedValue(true);

            const result = await forceResetPipeline('p1');
            expect(result.success).toBe(true);
            expect(INFINITE_PIPELINE_STATE['p1']).toBeUndefined();
        });

        it('should delete persisted state if getItem returns null', async () => {
            store.getItem.mockResolvedValue(null);
            store.deleteItem.mockResolvedValue(true);
            store.queryItems.mockResolvedValue([]);

            const result = await forceResetPipeline('p-nostate');
            expect(result.success).toBe(true);
        });
    });

    describe('getActiveCount', () => {
        it('should count running pipelines', () => {
            INFINITE_PIPELINE_STATE['p1'] = { running: true };
            INFINITE_PIPELINE_STATE['p2'] = { running: true };
            INFINITE_PIPELINE_STATE['p3'] = { running: false };
            expect(getActiveCount()).toBe(2);
        });

        it('should return 0 when no pipelines running', () => {
            expect(getActiveCount()).toBe(0);
        });
    });

    describe('cleanupStaleStateEntries', () => {
        it('should remove non-running entries when over MAX_STATE_ENTRIES', () => {
            for (let i = 0; i < 25; i++) {
                INFINITE_PIPELINE_STATE[`p${i}`] = { running: false };
            }
            INFINITE_PIPELINE_STATE['p-running'] = { running: true };
            cleanupStaleStateEntries();
            const remaining = Object.keys(INFINITE_PIPELINE_STATE);
            expect(remaining).toContain('p-running');
            expect(remaining.length).toBeLessThan(26);
        });
    });
});
