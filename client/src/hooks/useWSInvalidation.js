import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import wsManager from '../services/wsClient';
import { CHAPTER_KEYS } from './queries/useChapters';
import { MATERIAL_KEYS } from './queries/useMaterials';

export function useWSInvalidation(projectId) {
    const queryClient = useQueryClient();
    const stepDebounceRef = useRef(null);

    useEffect(() => {
        if (!projectId) return;

        const handler = (msg) => {
            const event = msg?.event;
            if (!event) return;

            switch (event) {
                case 'pipeline:step':
                    clearTimeout(stepDebounceRef.current);
                    stepDebounceRef.current = setTimeout(() => {
                        queryClient.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(projectId) });
                    }, 2000);
                    break;
                case 'pipeline:complete':
                    queryClient.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(projectId) });
                    queryClient.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(projectId) });
                    break;
                case 'pipeline:material-update':
                    queryClient.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(projectId) });
                    break;
                case 'pipeline:chapter-approved':
                    queryClient.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(projectId) });
                    break;
                case 'pipeline:chapter-failed':
                    queryClient.invalidateQueries({ queryKey: CHAPTER_KEYS.lists(projectId) });
                    break;
                default:
                    break;
            }
        };

        wsManager.subscribe(projectId, handler);
        return () => {
            wsManager.unsubscribe(projectId, handler);
            clearTimeout(stepDebounceRef.current);
        };
    }, [projectId, queryClient]);
}
