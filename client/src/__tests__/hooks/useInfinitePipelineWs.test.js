import { describe, test, expect } from 'vitest';
import { mapInfiniteLogs } from '../../pages/pipeline/useInfinitePipelineWs';

describe('mapInfiniteLogs', () => {
    test('maps passed log entry', () => {
        const logs = [{ step: 'writer', passed: true, feedback: 'ok', time: '2024-01-01', round: 1, chapterNumber: 1 }];
        const result = mapInfiniteLogs(logs);
        expect(result[0]).toEqual({ step: 'writer', status: 'done', result: { passed: true, feedback: 'ok' }, error: undefined, timestamp: '2024-01-01', round: 1, chapterNumber: 1, msg: undefined, affectedChapter: undefined });
    });

    test('maps failed log entry', () => {
        const logs = [{ step: 'writer', passed: false, error: 'timeout', timestamp: '2024-01-01' }];
        const result = mapInfiniteLogs(logs);
        expect(result[0].status).toBe('error');
        expect(result[0].error).toBe('timeout');
    });

    test('maps running log entry (passed undefined)', () => {
        const logs = [{ step: 'writer', timestamp: '2024-01-01' }];
        const result = mapInfiniteLogs(logs);
        expect(result[0].status).toBe('running');
        expect(result[0].result).toBeUndefined();
    });

    test('maps entry with msg and affectedChapter', () => {
        const logs = [{ step: 'writer', passed: true, msg: 'Writing chapter', affectedChapter: 5, time: '2024-01-01' }];
        const result = mapInfiniteLogs(logs);
        expect(result[0].msg).toBe('Writing chapter');
        expect(result[0].affectedChapter).toBe(5);
    });

    test('handles empty array', () => {
        expect(mapInfiniteLogs([])).toEqual([]);
    });
});
