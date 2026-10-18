import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = { currentProject: { id: 'p1', name: 'Test' } };

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ)
}));

vi.mock('react-router-dom', () => ({
    useSearchParams: vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()]),
}));

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../hooks/queries/useMaterials', () => ({
    useMaterials: vi.fn().mockReturnValue({ data: [] }),
    useMaterialLifecycle: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../hooks/queries/useEntityCenter', () => ({
    useEntityRegistry: vi.fn().mockReturnValue({ data: [], isLoading: false }),
    useItemDefinitions: vi.fn().mockReturnValue({ data: [] }),
    useCharacterBinds: vi.fn().mockReturnValue({ data: [] }),
    useCharacterRelations: vi.fn().mockReturnValue({ data: [] }),
    usePetEntities: vi.fn().mockReturnValue({ data: [] }),
    useServantEntities: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('../../hooks/queries/useCharacterStates', () => ({
    useCharacterList: vi.fn().mockReturnValue({ data: [] }),
    useKVIndex: vi.fn().mockReturnValue({ data: [] }),
    useStateSummary: vi.fn().mockReturnValue({ data: null }),
    useCharacterStates: vi.fn().mockReturnValue({ data: [] }),
    useStateMeta: vi.fn().mockReturnValue({ data: null }),
    useCharacterHistory: vi.fn().mockReturnValue({ data: [] }),
    useStateSync: vi.fn().mockReturnValue({ mutateAsync: vi.fn() }),
}));

vi.mock('../../hooks/queries/useChapters', () => ({
    useChapters: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('../../services/adapters', () => ({
    adaptEntity: vi.fn((e) => e),
    adaptPet: vi.fn((e) => e),
    adaptServant: vi.fn((e) => e),
    adaptRelation: vi.fn((e) => e),
    adaptList: vi.fn((list) => list),
    buildNameToIdMap: vi.fn().mockReturnValue({}),
}));

vi.mock('../../services/api', () => ({
    characterStateApi: { migrateChineseKeys: vi.fn().mockResolvedValue({ data: { migrated: 0, deleted: 0, statesMigrated: 0 } }) },
}));

describe('useEntityCenterState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        expect(result.current.activeTab).toBe('characters');
        expect(result.current.selectedCharId).toBeNull();
        expect(result.current.kvScopeFilter).toBe('all');
        expect(result.current.characters).toEqual([]);
    });

    test('setSelectedCharId updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setSelectedCharId('char1'); });
        expect(result.current.selectedCharId).toBe('char1');
    });

    test('setKvScopeFilter updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setKvScopeFilter('world'); });
        expect(result.current.kvScopeFilter).toBe('world');
    });

    test('setHistoryCharId updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setHistoryCharId('char1'); });
        expect(result.current.historyCharId).toBe('char1');
    });

    test('setSummaryCharId updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setSummaryCharId('char1'); });
        expect(result.current.summaryCharId).toBe('char1');
    });

    test('setSelectedChapter updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setSelectedChapter(5); });
        expect(result.current.selectedChapter).toBe(5);
    });

    test('setSyncFrom updates', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.setSyncFrom('1'); });
        expect(result.current.syncFrom).toBe('1');
    });

    test('toggleExpand toggles id', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.toggleExpand('id1'); });
        expect(result.current.expandedIds.has('id1')).toBe(true);
        act(() => { result.current.toggleExpand('id1'); });
        expect(result.current.expandedIds.has('id1')).toBe(false);
    });

    test('toggleDesc toggles level', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        act(() => { result.current.toggleDesc('id1'); });
        expect(result.current.descLevel.id1).toBe('detail');
        act(() => { result.current.toggleDesc('id1'); });
        expect(result.current.descLevel.id1).toBe('brief');
    });

    test('toBeijingTime formats correctly', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        expect(result.current.toBeijingTime(null)).toBe('未知');
        expect(result.current.toBeijingTime('')).toBe('未知');
        const formatted = result.current.toBeijingTime('2024-01-15T10:30:00Z');
        expect(formatted).toBeTruthy();
    });

    test('statsValues has expected shape', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        expect(result.current.statsValues).toHaveProperty('characters');
        expect(result.current.statsValues).toHaveProperty('equipment');
        expect(result.current.statsValues).toHaveProperty('techniques');
        expect(result.current.statsValues).toHaveProperty('pets');
        expect(result.current.statsValues).toHaveProperty('servants');
    });

    test('getCharName returns id when not found', async () => {
        const { default: useEntityCenterState } = await import('../../pages/entitycenter/useEntityCenterState');
        const { result } = renderHook(() => useEntityCenterState());
        expect(result.current.getCharName('unknown')).toBe('unknown');
    });
});
