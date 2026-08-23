import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel({
        currentProject: { id: 'p1', name: 'Test' },
        chapters: [],
    }) : {
        currentProject: { id: 'p1', name: 'Test' },
        chapters: [],
    })
}));

vi.mock('../../services/api', () => ({
    chaptersApi: {
        downloadNovel: vi.fn().mockResolvedValue({ data: 'novel text', headers: {} }),
    },
}));

vi.mock('../../hooks/queries', () => ({
    useChapters: vi.fn().mockReturnValue({ data: [], refetch: vi.fn().mockResolvedValue({ data: [] }) }),
    useUpdateChapter: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
    useDeleteChapter: vi.fn().mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ cascade: {} }) }),
    useResetChapter: vi.fn().mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ cascade: {} }) }),
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('useChaptersState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        expect(result.current.selectedChapter).toBeNull();
        expect(result.current.editMode).toBe(false);
        expect(result.current.filter).toBe('all');
        expect(result.current.collapsed).toBe(false);
    });

    test('setSelectedChapter updates', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        act(() => { result.current.setSelectedChapter({ id: 'ch1', title: 'Ch1' }); });
        expect(result.current.selectedChapter).toEqual({ id: 'ch1', title: 'Ch1' });
    });

    test('setFilter updates', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        act(() => { result.current.setFilter('written'); });
        expect(result.current.filter).toBe('written');
    });

    test('setCollapsed toggles', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        act(() => { result.current.setCollapsed(true); });
        expect(result.current.collapsed).toBe(true);
    });

    test('startEdit sets editMode and editForm', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        const chapter = { id: 'ch1', title: 'Chapter 1', outline: 'outline', content: 'content' };
        act(() => { result.current.startEdit(chapter); });
        expect(result.current.editMode).toBe(true);
        expect(result.current.editForm.title).toBe('Chapter 1');
        expect(result.current.selectedChapter).toEqual(chapter);
    });

    test('setEditMode toggles', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        act(() => { result.current.setEditMode(true); });
        expect(result.current.editMode).toBe(true);
    });

    test('setEditForm updates', async () => {
        const { default: useChaptersState } = await import('../../pages/chapters/useChaptersState');
        const { result } = renderHook(() => useChaptersState());
        act(() => { result.current.setEditForm({ title: 'New Title' }); });
        expect(result.current.editForm.title).toBe('New Title');
    });
});

describe('useChaptersState constants', () => {
    test('STATUS_LABELS has expected keys', async () => {
        const { STATUS_LABELS } = await import('../../pages/chapters/useChaptersState');
        expect(STATUS_LABELS.draft).toBe('草稿');
        expect(STATUS_LABELS.approved).toBe('已定稿');
    });

    test('STATUS_COLORS has expected keys', async () => {
        const { STATUS_COLORS } = await import('../../pages/chapters/useChaptersState');
        expect(STATUS_COLORS.draft).toBe('blue');
        expect(STATUS_COLORS.approved).toBe('green');
    });

    test('WRITTEN_STATUSES includes written and approved', async () => {
        const { WRITTEN_STATUSES } = await import('../../pages/chapters/useChaptersState');
        expect(WRITTEN_STATUSES).toContain('written');
        expect(WRITTEN_STATUSES).toContain('approved');
    });
});
