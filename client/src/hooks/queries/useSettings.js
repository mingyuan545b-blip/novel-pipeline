import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, promptConfigApi, styleTemplateApi } from '../../services/api';

export const SETTINGS_KEYS = {
    all: ['settings'],
    detail: () => [...SETTINGS_KEYS.all, 'detail'],
    constraintPresets: () => [...SETTINGS_KEYS.all, 'constraints'],
    promptConfig: (projectId) => [...SETTINGS_KEYS.all, 'prompt-config', projectId],
    styleTemplates: () => [...SETTINGS_KEYS.all, 'style-templates'],
};

export function useSettings() {
    return useQuery({
        queryKey: SETTINGS_KEYS.detail(),
        queryFn: () => settingsApi.get().then(r => r.data),
    });
}

export function useUpdateSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => settingsApi.save(data).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEYS.detail() }),
    });
}

export function useConstraintPresets() {
    return useQuery({
        queryKey: SETTINGS_KEYS.constraintPresets(),
        queryFn: () => promptConfigApi.listConstraintPresets().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}

export function useStyleTemplates() {
    return useQuery({
        queryKey: SETTINGS_KEYS.styleTemplates(),
        queryFn: () => styleTemplateApi.listTemplates().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}
