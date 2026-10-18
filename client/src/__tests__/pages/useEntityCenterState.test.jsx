import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    entityRegistryApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        update: vi.fn((id, d) => Promise.resolve({ data: { id, ...d } })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
    characterStateApi: {
        getStates: vi.fn(() => Promise.resolve({ data: {} })),
        getCharacters: vi.fn(() => Promise.resolve({ data: [] })),
        getMeta: vi.fn(() => Promise.resolve({ data: { currentChapter: 5 } })),
        migrateChineseKeys: vi.fn(() => Promise.resolve({ data: { migrated: 0, deleted: 0, statesMigrated: 0 } })),
    },
}));

vi.mock('../../hooks/queries/useEntityCenter', () => ({
    useEntityRegistry: vi.fn(() => ({ data: [], isLoading: false })),
    useItemDefinitions: vi.fn(() => ({ data: [] })),
    useCharacterBinds: vi.fn(() => ({ data: [] })),
    useCharacterRelations: vi.fn(() => ({ data: [] })),
    usePetEntities: vi.fn(() => ({ data: [] })),
    useServantEntities: vi.fn(() => ({ data: [] })),
}));

vi.mock('../../hooks/queries/useCharacterStates', () => ({
    useCharacterList: vi.fn(() => ({ data: [] })),
    useKVIndex: vi.fn(() => ({ data: [] })),
    useStateSummary: vi.fn(() => ({ data: null })),
    useCharacterStates: vi.fn(() => ({ data: [] })),
    useStateMeta: vi.fn(() => ({ data: null })),
    useCharacterHistory: vi.fn(() => ({ data: [] })),
    useStateSync: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock('../../hooks/queries/useMaterials', () => ({
    useMaterials: vi.fn(() => ({ data: [] })),
    useMaterialLifecycle: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
}));

vi.mock('../../hooks/queries/useChapters', () => ({
    useChapters: vi.fn(() => ({ data: [] })),
}));

vi.mock('../../services/adapters', () => ({
    adaptEntity: vi.fn((e) => e),
    adaptPet: vi.fn((e) => e),
    adaptServant: vi.fn((e) => e),
    adaptRelation: vi.fn((e) => e),
    adaptList: vi.fn((list) => list),
    buildNameToIdMap: vi.fn(() => ({})),
}));

function createRouterWrapper() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return function Wrapper({ children }) {
        return (
            <QueryClientProvider client={qc}>
                <MemoryRouter>{children}</MemoryRouter>
            </QueryClientProvider>
        );
    };
}

import useEntityCenterState from '../../pages/entitycenter/useEntityCenterState';

describe('useEntityCenterState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test', currentChapter: 5 },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useEntityCenterState(), { wrapper: createRouterWrapper() });
        expect(result.current.selectedCharId).toBe(null);
        expect(result.current.activeTab).toBe('characters');
    });

    test('selects character by id', () => {
        const { result } = renderHook(() => useEntityCenterState(), { wrapper: createRouterWrapper() });
        act(() => { result.current.setSelectedCharId('e1'); });
        expect(result.current.selectedCharId).toBe('e1');
    });

    test('changes tab via setSearchParams', () => {
        const { result } = renderHook(() => useEntityCenterState(), { wrapper: createRouterWrapper() });
        act(() => { result.current.setActiveTab('knowledge'); });
        expect(result.current.activeTab).toBe('knowledge');
    });

    test('returns statsValues with counts', () => {
        const { result } = renderHook(() => useEntityCenterState(), { wrapper: createRouterWrapper() });
        expect(result.current.statsValues).toEqual({
            characters: 0, equipment: 0, techniques: 0, pets: 0, servants: 0,
        });
    });
});
