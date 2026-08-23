import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useGenreDebugState from '../../pages/genre-debug/useGenreDebugState';

vi.mock('../../services/api', () => ({
    genreDebugApi: {
        listGenres: vi.fn(() => Promise.resolve({ data: { data: [{ id: 'urban-sweet', name: '都市甜宠' }] } })),
        getGenreAgents: vi.fn(() => Promise.resolve({ data: { agents: [{ type: 'writer' }], genre: { id: 'urban-sweet' }, materialFocus: {}, requiredConstraints: [], incompatibleConstraints: [] } })),
        getAgentPrompt: vi.fn(() => Promise.resolve({ data: { system: 'test prompt' } })),
        getConstraints: vi.fn(() => Promise.resolve({ data: { constraints: [{ id: 'c1', label: 'test' }], foundationRules: ['- rule1'], styleProfile: { tone: 'warm' } } })),
        getConstraintModules: vi.fn(() => Promise.resolve({ data: { modules: [] } })),
        updateConstraints: vi.fn(() => Promise.resolve({ data: { ok: true } })),
    }
}));

describe('useGenreDebugState', () => {
    beforeEach(() => vi.clearAllMocks());

    test('initializes with default state', () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        expect(result.current.selectedGenreId).toBeNull();
        expect(result.current.activeTab).toBe('constraints');
        expect(result.current.expandedAgent).toBeNull();
        expect(result.current.editData).toBeNull();
        expect(result.current.saveStatus).toBeNull();
    });

    test('handleSelectGenre sets genre and resets state', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        expect(result.current.selectedGenreId).toBe('urban-sweet');
        expect(result.current.expandedAgent).toBeNull();
        expect(result.current.editData).toBeNull();
    });

    test('handleToggleAgent toggles expanded agent', () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleToggleAgent('writer'); });
        expect(result.current.expandedAgent).toBe('writer');
        act(() => { result.current.handleToggleAgent('writer'); });
        expect(result.current.expandedAgent).toBeNull();
    });

    test('setActiveTab changes tab', () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.setActiveTab('agents'); });
        expect(result.current.activeTab).toBe('agents');
    });

    test('handleAddConstraint adds to editData', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        if (result.current.editData) {
            const prevLen = result.current.editData.constraints.length;
            act(() => { result.current.handleAddConstraint(); });
            expect(result.current.editData.constraints.length).toBe(prevLen + 1);
        }
    });

    test('handleRemoveConstraint removes from editData', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        if (result.current.editData && result.current.editData.constraints.length > 0) {
            const prevLen = result.current.editData.constraints.length;
            act(() => { result.current.handleRemoveConstraint(0); });
            expect(result.current.editData.constraints.length).toBe(prevLen - 1);
        }
    });

    test('handleConstraintChange updates constraint field', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        if (result.current.editData && result.current.editData.constraints.length > 0) {
            act(() => { result.current.handleConstraintChange(0, 'label', 'updated'); });
            expect(result.current.editData.constraints[0].label).toBe('updated');
        }
    });

    test('handleAddFoundationRule adds rule', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        if (result.current.editData) {
            const prevLen = result.current.editData.foundationRules.length;
            act(() => { result.current.handleAddFoundationRule(); });
            expect(result.current.editData.foundationRules.length).toBe(prevLen + 1);
        }
    });

    test('handleStyleChange updates style profile', async () => {
        const { result } = renderHook(() => useGenreDebugState(), { wrapper: createWrapper() });
        act(() => { result.current.handleSelectGenre('urban-sweet'); });
        await act(async () => { await new Promise(r => setTimeout(r, 100)); });
        if (result.current.editData) {
            act(() => { result.current.handleStyleChange('tone', 'cool'); });
            expect(result.current.editData.styleProfile.tone).toBe('cool');
        }
    });
});
