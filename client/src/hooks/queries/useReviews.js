import { useQuery } from '@tanstack/react-query';
import { reviewsApi } from '../../services/api';

export const REVIEW_KEYS = {
    all: ['reviews'],
    lists: (projectId) => [...REVIEW_KEYS.all, 'list', projectId],
    detail: (id) => [...REVIEW_KEYS.all, 'detail', id],
    byChapter: (chapterId) => [...REVIEW_KEYS.all, 'chapter', chapterId],
};

export function useReviews(projectId) {
    return useQuery({
        queryKey: REVIEW_KEYS.lists(projectId),
        queryFn: () => reviewsApi.list({ projectId }).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useReview(id) {
    return useQuery({
        queryKey: REVIEW_KEYS.detail(id),
        queryFn: () => reviewsApi.get(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useReviewsByChapter(chapterId) {
    return useQuery({
        queryKey: REVIEW_KEYS.byChapter(chapterId),
        queryFn: () => reviewsApi.list({ chapterId }).then(r => r.data),
        enabled: !!chapterId,
    });
}
