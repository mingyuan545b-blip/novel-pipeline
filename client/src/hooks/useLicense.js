import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licenseApi } from '../services/api';

export const LICENSE_KEYS = {
    all: ['license'],
    status: () => [...LICENSE_KEYS.all, 'status'],
};

export function useLicenseStatus() {
    return useQuery({
        queryKey: LICENSE_KEYS.status(),
        queryFn: async () => {
            const res = await licenseApi.getStatus();
            return res.data || { level: 'free', licensed: false };
        },
        staleTime: 60000,
    });
}

export function useActivateLicense() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (licenseKey) => {
            const res = await licenseApi.activate(licenseKey);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: LICENSE_KEYS.all });
        },
    });
}
