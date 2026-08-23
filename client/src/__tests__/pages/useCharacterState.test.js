import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../hooks/queries/useCharacterStates', () => ({
    useCharacterList: vi.fn(() => ({ data: [] })),
    useKVIndex: vi.fn(() => ({ data: [] })),
    useStateSummary: vi.fn(() => ({ data: null })),
    useCharacterStates: vi.fn(() => ({ data: [] })),
    useStateMeta: vi.fn(() => ({ data: null })),
    useCharacterHistory: vi.fn(() => ({ data: [] })),
    useStateSync: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('../../hooks/queries/useChapters', () => ({
    useChapters: vi.fn(() => ({ data: [] })),
}));

import useCharacterState from '../../pages/characterstate/useCharacterState';

describe('useCharacterState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({ currentProject: { id: 'p1', name: 'Test' } });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useCharacterState(), { wrapper: createWrapper() });
        expect(result.current.activeTab).toBe('characters');
        expect(result.current.selectedChapter).toBe(null);
    });

    test('sets active tab', () => {
        const { result } = renderHook(() => useCharacterState(), { wrapper: createWrapper() });
        act(() => { result.current.setActiveTab('states'); });
        expect(result.current.activeTab).toBe('states');
    });

    test('sets selected chapter', () => {
        const { result } = renderHook(() => useCharacterState(), { wrapper: createWrapper() });
        act(() => { result.current.setSelectedChapter(5); });
        expect(result.current.selectedChapter).toBe(5);
    });
});
