/**
 * useQuestState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    questApi: {
        listQuests: vi.fn().mockResolvedValue({ data: [] }),
        createQuest: vi.fn().mockResolvedValue({ data: {} }),
        updateQuest: vi.fn().mockResolvedValue({ data: {} }),
        deleteQuest: vi.fn().mockResolvedValue({ data: {} }),
        getMeta: vi.fn().mockResolvedValue({ data: null }),
    }
}));

import useQuestState from '../../pages/materials/useQuestState';

describe('useQuestState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useQuestState(null, 'quests'));
        expect(result.current.quests).toEqual([]);
        expect(result.current.showQuestForm).toBe(false);
        expect(result.current.editingQuest).toBeNull();
        expect(result.current.questForm).toEqual(result.current.INITIAL_QUEST_FORM);
        expect(result.current.questStatusFilter).toBe('all');
    });

    test('setShowQuestForm toggles form', () => {
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        act(() => { result.current.setShowQuestForm(true); });
        expect(result.current.showQuestForm).toBe(true);
    });

    test('setEditingQuest sets quest', () => {
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        act(() => { result.current.setEditingQuest('q-1'); });
        expect(result.current.editingQuest).toBe('q-1');
    });

    test('setQuestForm updates form', () => {
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        act(() => { result.current.setQuestForm(prev => ({ ...prev, title: 'New Quest' })); });
        expect(result.current.questForm.title).toBe('New Quest');
    });

    test('toggleQuestExpand toggles', () => {
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        act(() => { result.current.toggleQuestExpand('q-1'); });
        expect(result.current.expandedQuests.has('q-1')).toBe(true);
        act(() => { result.current.toggleQuestExpand('q-1'); });
        expect(result.current.expandedQuests.has('q-1')).toBe(false);
    });

    test('saveQuest skips without project', async () => {
        const { questApi } = await import('../../services/api');
        const { result } = renderHook(() => useQuestState(null, 'quests'));
        await act(async () => { await result.current.saveQuest(); });
        expect(questApi.createQuest).not.toHaveBeenCalled();
    });

    test('deleteQuest cancels when user declines', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        const { questApi } = await import('../../services/api');
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        await act(async () => { await result.current.deleteQuest('q-1'); });
        expect(questApi.deleteQuest).not.toHaveBeenCalled();
        window.confirm.mockRestore();
    });

    test('filterQuestsByStatus sets filter', () => {
        const { result } = renderHook(() => useQuestState({ id: 'p1' }, 'quests'));
        act(() => { result.current.filterQuestsByStatus('active'); });
        expect(result.current.questStatusFilter).toBe('active');
    });
});
