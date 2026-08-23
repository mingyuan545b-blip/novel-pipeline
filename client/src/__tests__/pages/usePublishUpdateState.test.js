/**
 * usePublishUpdateState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { usePublishUpdateState } from '../../pages/publish/usePublishUpdateState';

describe('usePublishUpdateState', () => {
    test('returns initial state', () => {
        const { result } = renderHook(() => usePublishUpdateState());
        expect(result.current.updateChapterInput).toBe('');
        expect(result.current.updateRangeStart).toBe('');
        expect(result.current.updateRangeEnd).toBe('');
        expect(result.current.showUpdateDialog).toBe(false);
        expect(result.current.updatePlatform).toBe('');
    });

    test('sets updateChapterInput', () => {
        const { result } = renderHook(() => usePublishUpdateState());
        act(() => { result.current.setUpdateChapterInput('5'); });
        expect(result.current.updateChapterInput).toBe('5');
    });

    test('sets updateRangeStart and updateRangeEnd', () => {
        const { result } = renderHook(() => usePublishUpdateState());
        act(() => { result.current.setUpdateRangeStart('1'); });
        act(() => { result.current.setUpdateRangeEnd('10'); });
        expect(result.current.updateRangeStart).toBe('1');
        expect(result.current.updateRangeEnd).toBe('10');
    });

    test('sets showUpdateDialog', () => {
        const { result } = renderHook(() => usePublishUpdateState());
        act(() => { result.current.setShowUpdateDialog(true); });
        expect(result.current.showUpdateDialog).toBe(true);
    });

    test('sets updatePlatform', () => {
        const { result } = renderHook(() => usePublishUpdateState());
        act(() => { result.current.setUpdatePlatform('qidian'); });
        expect(result.current.updatePlatform).toBe('qidian');
    });
});
