import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    libraryApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        getIndex: vi.fn(() => Promise.resolve({ data: { entries: [] } })),
        getStats: vi.fn(() => Promise.resolve({ data: {} })),
        getTechnique: vi.fn(() => Promise.resolve({ data: {} })),
        search: vi.fn(() => Promise.resolve({ data: [] })),
        updateTechnique: vi.fn(() => Promise.resolve({ data: {} })),
        updateMeta: vi.fn(() => Promise.resolve({ data: {} })),
        resetMeta: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

import useLibraryState, { DEPT_ICONS, DEPT_COLORS, SLOT_LABELS, cleanName } from '../../pages/library/useLibraryState';

describe('DEPT_ICONS', () => {
    test('has icons for departments', () => {
        expect(Object.keys(DEPT_ICONS).length).toBeGreaterThan(0);
    });
});

describe('cleanName', () => {
    test('removes numeric prefix', () => {
        expect(cleanName('00_叙事之魂部')).toBe('叙事之魂部');
        expect(cleanName('01_顶层设计部')).toBe('顶层设计部');
    });
});

describe('useLibraryState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        expect(result.current.searchQuery).toBe('');
        expect(result.current.treeData).toEqual({});
    });

    test('sets search query', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        act(() => { result.current.setSearchQuery('测试'); });
        expect(result.current.searchQuery).toBe('测试');
    });

    test('sets mode filter', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        act(() => { result.current.setModeFilter('novel'); });
        expect(result.current.modeFilter).toBe('novel');
    });
});
