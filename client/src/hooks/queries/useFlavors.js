import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flavorsApi } from '../../services/api';

export const FLAVOR_KEYS = {
    dialects: ['flavors', 'dialects'],
    styles: ['flavors', 'styles'],
    naming: ['flavors', 'naming'],
    systemPersonas: ['flavors', 'system-personas'],
    genreProfiles: ['flavors', 'genre-profiles'],
    worldviewTemplates: ['flavors', 'worldview-templates'],
    preview: (config) => ['flavors', 'preview', config],
};

export function useDialects() {
    return useQuery({
        queryKey: FLAVOR_KEYS.dialects,
        queryFn: () => flavorsApi.getDialects().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useDialect(region) {
    return useQuery({
        queryKey: [...FLAVOR_KEYS.dialects, region],
        queryFn: () => flavorsApi.getDialect(region).then(r => r.data),
        enabled: !!region,
        staleTime: 10 * 60 * 1000,
    });
}

export function useSpeechStyles() {
    return useQuery({
        queryKey: FLAVOR_KEYS.styles,
        queryFn: () => flavorsApi.getSpeechStyles().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useNamingStyles() {
    return useQuery({
        queryKey: FLAVOR_KEYS.naming,
        queryFn: () => flavorsApi.getNamingStyles().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useSystemPersonas() {
    return useQuery({
        queryKey: FLAVOR_KEYS.systemPersonas,
        queryFn: () => flavorsApi.getSystemPersonas().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useGenreProfiles() {
    return useQuery({
        queryKey: FLAVOR_KEYS.genreProfiles,
        queryFn: () => flavorsApi.getGenreProfiles().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useWorldviewTemplates() {
    return useQuery({
        queryKey: FLAVOR_KEYS.worldviewTemplates,
        queryFn: () => flavorsApi.getWorldviewTemplates().then(r => r.data),
        staleTime: 10 * 60 * 1000,
    });
}

export function useInferNamingStyle(genre) {
    return useQuery({
        queryKey: [...FLAVOR_KEYS.naming, 'infer', genre],
        queryFn: () => flavorsApi.inferNamingStyle(genre).then(r => r.data),
        enabled: !!genre,
    });
}

export function useResolveGenreProfile(genre) {
    return useQuery({
        queryKey: [...FLAVOR_KEYS.genreProfiles, 'resolve', genre],
        queryFn: () => flavorsApi.resolveGenreProfile(genre).then(r => r.data),
        enabled: !!genre,
    });
}

export function useCombinedFlavorPreview() {
    return useMutation({
        mutationFn: (config) => flavorsApi.previewCombined(config).then(r => r.data),
    });
}

export function useReloadFlavors() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => flavorsApi.reload().then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: FLAVOR_KEYS.dialects });
            qc.invalidateQueries({ queryKey: FLAVOR_KEYS.styles });
            qc.invalidateQueries({ queryKey: FLAVOR_KEYS.naming });
            qc.invalidateQueries({ queryKey: FLAVOR_KEYS.systemPersonas });
            qc.invalidateQueries({ queryKey: FLAVOR_KEYS.genreProfiles });
        },
    });
}
