import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityRegistryApi, itemDefinitionsApi, characterBindsApi, characterRelationsApi, petEntitiesApi, servantEntitiesApi } from '../../services/api';

export const ENTITY_KEYS = {
    all: ['entities'],
    registry: (projectId, filters) => [...ENTITY_KEYS.all, 'registry', projectId, JSON.stringify(filters)],
    definitions: (projectId, filters) => [...ENTITY_KEYS.all, 'definitions', projectId, JSON.stringify(filters)],
    binds: (projectId, filters) => [...ENTITY_KEYS.all, 'binds', projectId, JSON.stringify(filters)],
    relations: (projectId, filters) => [...ENTITY_KEYS.all, 'relations', projectId, JSON.stringify(filters)],
    pets: (projectId, filters) => [...ENTITY_KEYS.all, 'pets', projectId, JSON.stringify(filters)],
    servants: (projectId, filters) => [...ENTITY_KEYS.all, 'servants', projectId, JSON.stringify(filters)],
};

export function useEntityRegistry(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.registry(projectId, filters),
        queryFn: () => entityRegistryApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useItemDefinitions(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.definitions(projectId, filters),
        queryFn: () => itemDefinitionsApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useCharacterBinds(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.binds(projectId, filters),
        queryFn: () => characterBindsApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useCharacterRelations(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.relations(projectId, filters),
        queryFn: () => characterRelationsApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePetEntities(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.pets(projectId, filters),
        queryFn: () => petEntitiesApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useServantEntities(projectId, filters = {}) {
    return useQuery({
        queryKey: ENTITY_KEYS.servants(projectId, filters),
        queryFn: () => servantEntitiesApi.list({ projectId, ...filters }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useCreateEntity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, data }) => {
            const apis = { 'entity-registry': entityRegistryApi, 'item-definitions': itemDefinitionsApi, 'character-binds': characterBindsApi, 'character-relations': characterRelationsApi, 'pet-entities': petEntitiesApi, 'servant-entities': servantEntitiesApi };
            return apis[type].create(data).then(r => r.data);
        },
        onSuccess: (_data, _vars) => qc.invalidateQueries({ queryKey: ENTITY_KEYS.all }),
    });
}

export function useUpdateEntity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, id, data }) => {
            const apis = { 'entity-registry': entityRegistryApi, 'item-definitions': itemDefinitionsApi, 'character-binds': characterBindsApi, 'character-relations': characterRelationsApi, 'pet-entities': petEntitiesApi, 'servant-entities': servantEntitiesApi };
            return apis[type].update(id, data).then(r => r.data);
        },
        onSuccess: (_data, _vars) => qc.invalidateQueries({ queryKey: ENTITY_KEYS.all }),
    });
}

export function useDeleteEntity() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, id }) => {
            const apis = { 'entity-registry': entityRegistryApi, 'item-definitions': itemDefinitionsApi, 'character-binds': characterBindsApi, 'character-relations': characterRelationsApi, 'pet-entities': petEntitiesApi, 'servant-entities': servantEntitiesApi };
            return apis[type].delete(id).then(r => r.data);
        },
        onSuccess: (_data, _vars) => qc.invalidateQueries({ queryKey: ENTITY_KEYS.all }),
    });
}
