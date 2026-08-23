/**
 * useKnowledgeState (entity center) hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import useKnowledgeState from '../../pages/entitycenter/useKnowledgeState';

vi.mock('../../services/api', () => ({
    knowledgeAccessApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
    }
}));

const { knowledgeAccessApi } = await import('../../services/api');

describe('useKnowledgeState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        expect(result.current.records).toEqual([]);
        expect(result.current.loading).toBe(true); // useEffect triggers loadRecords immediately
        expect(result.current.filter).toEqual({ factId: '', entityId: '' });
        expect(result.current.showForm).toBe(false);
        expect(result.current.saving).toBe(false);
    });

    test('loads records on mount', async () => {
        knowledgeAccessApi.list.mockResolvedValueOnce({ data: [{ id: '1' }] });
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        await act(async () => { await vi.waitFor(() => expect(knowledgeAccessApi.list).toHaveBeenCalled()); });
        expect(result.current.records).toEqual([{ id: '1' }]);
    });

    test('skips load without projectId', async () => {
        renderHook(() => useKnowledgeState(null, []));
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        expect(knowledgeAccessApi.list).not.toHaveBeenCalled();
    });

    test('updateFilter sets filter', () => {
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        act(() => { result.current.updateFilter('factId', 'fact-1'); });
        expect(result.current.filter.factId).toBe('fact-1');
    });

    test('updateForm sets form', () => {
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        act(() => { result.current.updateForm('entityName', '张三'); });
        expect(result.current.form.entityName).toBe('张三');
    });

    test('setShowForm toggles form', () => {
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        act(() => { result.current.setShowForm(true); });
        expect(result.current.showForm).toBe(true);
    });

    test('handleCreate skips without factId', async () => {
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        await act(async () => { await result.current.handleCreate(); });
        expect(knowledgeAccessApi.create).not.toHaveBeenCalled();
    });

    test('handleCreate calls API with valid form', async () => {
        knowledgeAccessApi.create.mockResolvedValueOnce({ data: {} });
        knowledgeAccessApi.list.mockResolvedValue({ data: [] });
        const characters = [{ id: 'char-1', name: '张三', _adapted: { name: '张三' } }];
        const { result } = renderHook(() => useKnowledgeState('proj-1', characters));
        act(() => {
            result.current.updateForm('factId', 'fact-1');
            result.current.updateForm('entityName', '张三');
        });
        await act(async () => { await result.current.handleCreate(); });
        expect(knowledgeAccessApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ projectId: 'proj-1', factId: 'fact-1', entityId: 'char-1' })
        );
    });

    test('handleDelete calls API', async () => {
        knowledgeAccessApi.delete.mockResolvedValueOnce({ data: {} });
        knowledgeAccessApi.list.mockResolvedValue({ data: [] });
        const { result } = renderHook(() => useKnowledgeState('proj-1', []));
        await act(async () => { await result.current.handleDelete('rec-1'); });
        expect(knowledgeAccessApi.delete).toHaveBeenCalledWith('rec-1');
    });
});
