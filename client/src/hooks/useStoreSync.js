import { useQueryClient } from '@tanstack/react-query';
import useAppStore from '../store/useAppStore';
import { PROJECT_KEYS } from './queries/useProjects';
import { CHAPTER_KEYS } from './queries/useChapters';
import { MATERIAL_KEYS } from './queries/useMaterials';
import { REVIEW_KEYS } from './queries/useReviews';

export function useInvalidateOnMutation() {
    const queryClient = useQueryClient();
    const currentProject = useAppStore(s => s.currentProject);

    return {
        invalidateProjects: () => queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() }),
        invalidateChapters: () => queryClient.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(currentProject?.id) }),
        invalidateMaterials: () => queryClient.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(currentProject?.id) }),
        invalidateReviews: (params) => queryClient.invalidateQueries({ queryKey: REVIEW_KEYS.lists(params?.projectId, params?.status, params?.page, params?.pageSize) }),
        invalidateAll: () => queryClient.invalidateQueries(),
    };
}
