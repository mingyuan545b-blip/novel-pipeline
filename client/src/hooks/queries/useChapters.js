import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chaptersApi } from '../../services/api';

export const CHAPTER_KEYS = {
    all: ['chapters'],
    lists: (projectId) => [...CHAPTER_KEYS.all, 'list', projectId],
    detail: (id) => [...CHAPTER_KEYS.all, 'detail', id],
    byNumber: (projectId, num) => [...CHAPTER_KEYS.all, 'number', projectId, num],
};

export function useChapters(projectId) {
    return useQuery({
        queryKey: CHAPTER_KEYS.lists(projectId),
        queryFn: () => chaptersApi.list({ projectId }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useChapter(id) {
    return useQuery({
        queryKey: CHAPTER_KEYS.detail(id),
        queryFn: () => chaptersApi.get(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useUpdateChapter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => chaptersApi.update(id, data).then(r => r.data),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: CHAPTER_KEYS.detail(data.id) });
            if (data.projectId) qc.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(data.projectId) });
        },
    });
}

export function useDeleteChapter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => chaptersApi.delete(id).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: CHAPTER_KEYS.all }),
    });
}

export function useResetChapter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => chaptersApi.reset(id).then(r => r.data),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: CHAPTER_KEYS.detail(data.id) });
            if (data.projectId) qc.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(data.projectId) });
        },
    });
}
