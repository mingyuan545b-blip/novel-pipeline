import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
    useMutation: vi.fn((_opts) => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isLoading: false })),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../services/api', () => ({
    genreDebugApi: {
        listGenres: vi.fn().mockResolvedValue({ data: [] }),
        getGenreAgents: vi.fn().mockResolvedValue({ data: {} }),
        getAgentPrompt: vi.fn().mockResolvedValue({ data: {} }),
        getConstraints: vi.fn().mockResolvedValue({ data: {} }),
        getConstraintModules: vi.fn().mockResolvedValue({ data: {} }),
        updateConstraints: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

describe('useGenreDebugState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        expect(result.current.selectedGenreId).toBeNull();
        expect(result.current.activeTab).toBe('constraints');
        expect(result.current.expandedAgent).toBeNull();
        expect(result.current.editData).toBeNull();
        expect(result.current.saveStatus).toBeNull();
    });

    test('setActiveTab updates', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.setActiveTab('agents'); });
        expect(result.current.activeTab).toBe('agents');
    });

    test('setExpandedModule updates', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.setExpandedModule('module1'); });
        expect(result.current.expandedModule).toBe('module1');
    });

    test('handleSelectGenre updates selectedGenreId', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleSelectGenre('urban-fantasy'); });
        expect(result.current.selectedGenreId).toBe('urban-fantasy');
        expect(result.current.expandedAgent).toBeNull();
    });

    test('handleToggleAgent toggles', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleToggleAgent('writer'); });
        expect(result.current.expandedAgent).toBe('writer');
        act(() => { result.current.handleToggleAgent('writer'); });
        expect(result.current.expandedAgent).toBeNull();
    });

    test('handleConstraintChange does nothing without editData', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleConstraintChange(0, 'label', 'test'); });
        expect(result.current.editData).toBeNull();
    });

    test('handleAddConstraint does nothing without editData', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleAddConstraint(); });
        expect(result.current.editData).toBeNull();
    });

    test('handleRemoveConstraint does nothing without editData', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleRemoveConstraint(0); });
        expect(result.current.editData).toBeNull();
    });

    test('handleFoundationRuleChange does nothing without editData', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleFoundationRuleChange(0, 'new rule'); });
        expect(result.current.editData).toBeNull();
    });

    test('handleStyleChange does nothing without editData', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleStyleChange('field', 'value'); });
        expect(result.current.editData).toBeNull();
    });

    test('handleSave does nothing without editData', async () => {
        const { useMutation } = await import('@tanstack/react-query');
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        act(() => { result.current.handleSave(); });
        // 真断言：saveMutation.mutate 必须没被调用（原测试只写注释，等于什么都没验）
        const mutates = useMutation.mock.results.map(r => r.value && r.value.mutate).filter(Boolean);
        expect(mutates.length).toBeGreaterThan(0);
        mutates.forEach(m => expect(m).not.toHaveBeenCalled());
    });

    test('genres defaults to empty array', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        expect(result.current.genres).toEqual([]);
    });

    test('agents defaults to empty array', async () => {
        const { default: useGenreDebugState } = await import('../../pages/genre-debug/useGenreDebugState');
        const { result } = renderHook(() => useGenreDebugState());
        expect(result.current.agents).toEqual([]);
    });
});
