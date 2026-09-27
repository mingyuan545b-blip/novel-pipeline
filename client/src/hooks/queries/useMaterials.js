import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialsApi } from '../../services/api';

export const MATERIAL_KEYS = {
    all: ['materials'],
    lists: (projectId) => [...MATERIAL_KEYS.all, 'list', projectId],
    detail: (id) => [...MATERIAL_KEYS.all, 'detail', id],
    byType: (projectId, type) => [...MATERIAL_KEYS.all, 'type', projectId, type],
};

export function useMaterials(projectId, filters = {}) {
    return useQuery({
        queryKey: [...MATERIAL_KEYS.lists(projectId), JSON.stringify(filters)],
        queryFn: () => {
            return materialsApi.list({ projectId, ...filters }).then(r => r.data);
        },
        enabled: !!projectId,
    });
}

export function useMaterial(id) {
    return useQuery({
        queryKey: MATERIAL_KEYS.detail(id),
        queryFn: () => materialsApi.get(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useCreateMaterial() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => materialsApi.create(data).then(r => r.data),
        onSuccess: (data) => qc.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(data.projectId) }),
    });
}

export function useUpdateMaterial(id, projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => materialsApi.update(id, data).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: MATERIAL_KEYS.detail(id) });
            if (projectId) qc.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(projectId) });
        },
    });
}

/** 素材生命周期（归档/报废 + 章节区间）：单点写入被加载的 materials */
export function useMaterialLifecycle(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }) => materialsApi.update(id, patch).then(r => r.data),
        onSuccess: (_, v) => {
            qc.invalidateQueries({ queryKey: MATERIAL_KEYS.detail(v.id) });
            if (projectId) qc.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(projectId) });
        },
    });
}

export function useDeleteMaterial() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => materialsApi.delete(id).then(r => r.data),
        onSuccess: (_, variables) => qc.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(variables._projectId) }),
    });
}
