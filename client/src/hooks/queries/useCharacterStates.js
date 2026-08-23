import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { characterStateApi } from '../../services/api';

export const STATE_KEYS = {
    all: ['character-states'],
    states: (projectId, chapter) => [...STATE_KEYS.all, 'states', projectId, chapter || 'all'],
    characters: (projectId, chapter) => [...STATE_KEYS.all, 'characters', projectId, chapter || 'current'],
    kv: (projectId, filters) => [...STATE_KEYS.all, 'kv', projectId, JSON.stringify(filters)],
    summary: (projectId, chapter, characterId) => [...STATE_KEYS.all, 'summary', projectId, chapter || 'current', characterId || 'all'],
    history: (projectId, characterId, limit) => [...STATE_KEYS.all, 'history', projectId, characterId, limit || 'all'],
    meta: (projectId) => [...STATE_KEYS.all, 'meta', projectId],
};

export function useCharacterStates(projectId, chapter) {
    return useQuery({
        queryKey: STATE_KEYS.states(projectId, chapter),
        queryFn: () => characterStateApi.getStates(projectId, chapter).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useCharacterList(projectId, chapter) {
    return useQuery({
        queryKey: STATE_KEYS.characters(projectId, chapter),
        queryFn: () => characterStateApi.getCharacters(projectId, chapter).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useKVIndex(projectId, filters) {
    return useQuery({
        queryKey: STATE_KEYS.kv(projectId, filters),
        queryFn: () => characterStateApi.getKV(projectId, filters).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useStateSummary(projectId, chapter, characterId) {
    return useQuery({
        queryKey: STATE_KEYS.summary(projectId, chapter, characterId),
        queryFn: () => characterStateApi.getSummary(projectId, chapter, characterId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useCharacterHistory(projectId, characterId, limit) {
    return useQuery({
        queryKey: STATE_KEYS.history(projectId, characterId, limit),
        queryFn: () => characterStateApi.getHistory(projectId, characterId, limit).then(r => r.data),
        enabled: !!projectId && !!characterId,
    });
}

export function useStateMeta(projectId) {
    return useQuery({
        queryKey: STATE_KEYS.meta(projectId),
        queryFn: () => characterStateApi.getMeta(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useStateSync() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, fromChapter, toChapter }) => characterStateApi.sync(projectId, fromChapter, toChapter).then(r => r.data),
        onSuccess: (data, vars) => {
            qc.invalidateQueries({ queryKey: STATE_KEYS.states(vars.projectId) });
            qc.invalidateQueries({ queryKey: STATE_KEYS.characters(vars.projectId) });
            qc.invalidateQueries({ queryKey: STATE_KEYS.kv(vars.projectId) });
            qc.invalidateQueries({ queryKey: STATE_KEYS.meta(vars.projectId) });
        },
    });
}