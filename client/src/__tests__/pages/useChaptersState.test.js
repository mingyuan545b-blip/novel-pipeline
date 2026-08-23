import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    chaptersApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        downloadNovel: vi.fn(() => Promise.resolve({ data: 'novel text', headers: {} })),
    },
}));

vi.mock('../../hooks/queries', () => ({
    useChapters: vi.fn(() => ({ data: [], refetch: vi.fn(() => Promise.resolve({ data: [] })) })),
    useUpdateChapter: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({})) })),
    useDeleteChapter: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({ cascade: {} })) })),
    useResetChapter: vi.fn(() => ({ mutateAsync: vi.fn(() => Promise.resolve({ cascade: {} })) })),
}));

import useChaptersState, { STATUS_LABELS, STATUS_COLORS, WRITTEN_STATUSES } from '../../pages/chapters/useChaptersState';

describe('STATUS_LABELS', () => {
    test('has labels for all key statuses', () => {
        expect(STATUS_LABELS.draft).toBe('草稿');
        expect(STATUS_LABELS.written).toBe('已创作');
        expect(STATUS_LABELS.approved).toBe('已定稿');
        expect(STATUS_LABELS['material-updated']).toBe('素材已更新');
    });
});

describe('STATUS_COLORS', () => {
    test('maps statuses to colors', () => {
        expect(STATUS_COLORS.draft).toBe('blue');
        expect(STATUS_COLORS.approved).toBe('green');
    });
});

describe('WRITTEN_STATUSES', () => {
    test('includes written and post-written statuses', () => {
        expect(WRITTEN_STATUSES).toContain('written');
        expect(WRITTEN_STATUSES).toContain('approved');
        expect(WRITTEN_STATUSES).toContain('material-updated');
        expect(WRITTEN_STATUSES).not.toContain('draft');
    });
});

describe('useChaptersState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
                chapters: [],
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useChaptersState(), { wrapper: createWrapper() });
        expect(result.current.selectedChapter).toBe(null);
        expect(result.current.editMode).toBe(false);
        expect(result.current.filter).toBe('all');
        expect(result.current.collapsed).toBe(false);
    });

    test('startEdit sets edit mode and form', () => {
        const { result } = renderHook(() => useChaptersState(), { wrapper: createWrapper() });
        const chapter = { id: 'c1', title: 'Ch1', outline: 'outline', content: 'content' };
        act(() => { result.current.startEdit(chapter); });
        expect(result.current.editMode).toBe(true);
        expect(result.current.editForm.title).toBe('Ch1');
        expect(result.current.selectedChapter.id).toBe('c1');
    });

    test('filter changes update filtered chapters', () => {
        const { result } = renderHook(() => useChaptersState(), { wrapper: createWrapper() });
        act(() => { result.current.setFilter('written'); });
        expect(result.current.filter).toBe('written');
    });

    test('collapsed state toggles', () => {
        const { result } = renderHook(() => useChaptersState(), { wrapper: createWrapper() });
        act(() => { result.current.setCollapsed(true); });
        expect(result.current.collapsed).toBe(true);
    });
});
