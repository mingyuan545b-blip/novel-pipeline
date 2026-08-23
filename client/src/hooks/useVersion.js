import { useQuery } from '@tanstack/react-query';
import { versionApi } from '../services/api';

export const VERSION_KEYS = {
    all: ['version'],
    info: () => [...VERSION_KEYS.all, 'info'],
};

export function useVersionInfo() {
    return useQuery({
        queryKey: VERSION_KEYS.info(),
        queryFn: async () => {
            const res = await versionApi.getInfo();
            return res.data || null;
        },
        staleTime: 300000,
        retry: 1,
    });
}
