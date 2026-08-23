import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    projectsApi: {
        update: vi.fn().mockResolvedValue({ data: {} }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        remediate: vi.fn().mockResolvedValue({ data: {} }),
        analyzeStyle: vi.fn().mockResolvedValue({ data: { success: true } }),
        updateStyleGuidance: vi.fn().mockResolvedValue({}),
    },
    styleTemplateApi: {
        getTemplate: vi.fn().mockResolvedValue({ data: { id: 'st1', rules: {}, example: '' } }),
        createTemplate: vi.fn().mockResolvedValue({ data: { id: 'st2', rules: {}, example: '' } }),
        updateTemplate: vi.fn().mockResolvedValue({ data: {} }),
    },
    promptConfigApi: {
        listConstraintPresets: vi.fn().mockResolvedValue({ data: [{ id: 'cp1', name: 'Preset 1' }] }),
    },
}));

vi.mock('../../pages/dashboard/useStyleCleanupState', () => ({
    useStyleCleanupState: vi.fn().mockReturnValue({
        cleanupLoading: false, cleanupResult: null,
        handleCleanup: vi.fn(), handleDeleteRemediation: vi.fn(),
        cleanupStats: null, loadCleanupStats: vi.fn(),
    })
}));

describe('useStyleAndConstraintsState', () => {
    const props = {
        currentProject: { id: 'p1', name: 'Test', constraints: ['cp1'], styleTemplateId: 'st1' },
        setProjects: vi.fn(),
        showError: vi.fn(),
    };

    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        expect(result.current.editingConstraints).toBe(false);
        expect(result.current.constraintPresets).toEqual([]);
        expect(result.current.styleTemplate).toBeNull();
    });

    test('startEditConstraints sets editing', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.startEditConstraints(); });
        expect(result.current.editingConstraints).toBe(true);
        expect(result.current.editConstraints).toEqual(['cp1']);
    });

    test('toggleEditConstraint adds and removes', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.startEditConstraints(); });
        act(() => { result.current.toggleEditConstraint('cp2'); });
        expect(result.current.editConstraints).toContain('cp2');
        act(() => { result.current.toggleEditConstraint('cp2'); });
        expect(result.current.editConstraints).not.toContain('cp2');
    });

    test('setStyleSuggestion updates', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.setStyleSuggestion('更细腻'); });
        expect(result.current.styleSuggestion).toBe('更细腻');
    });

    test('setReviewText updates', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.setReviewText('审核意见'); });
        expect(result.current.reviewText).toBe('审核意见');
    });

    test('startEditingStyle sets editing', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.startEditingStyle(); });
        expect(result.current.editingStyle).toBe(true);
    });

    test('setStyleEditForm updates', async () => {
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        act(() => { result.current.setStyleEditForm({ rules: { tone: 'gentle' }, example: 'test' }); });
        expect(result.current.styleEditForm.rules.tone).toBe('gentle');
    });

    test('handleRemediate returns without reviewText', async () => {
        const { projectsApi } = await import('../../services/api');
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState(props));
        await act(async () => { await result.current.handleRemediate(); });
        expect(projectsApi.remediate).not.toHaveBeenCalled();
    });

    test('handleAnalyzeStyle returns without project', async () => {
        const { projectsApi } = await import('../../services/api');
        const { default: useStyleAndConstraintsState } = await import('../../pages/dashboard/useStyleAndConstraintsState');
        const { result } = renderHook(() => useStyleAndConstraintsState({ ...props, currentProject: null }));
        await act(async () => { await result.current.handleAnalyzeStyle(); });
        expect(projectsApi.analyzeStyle).not.toHaveBeenCalled();
    });
});
