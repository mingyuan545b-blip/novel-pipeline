import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi, pipelineApi, promptConfigApi } from '../../services/api';

export const AGENT_KEYS = {
    all: ['agents'],
    lists: (mode) => [...AGENT_KEYS.all, 'list', mode || 'novel'],
    detail: (type, mode, projectId) => [...AGENT_KEYS.all, 'detail', type, mode || 'novel', projectId || 'global'],
    templates: () => [...AGENT_KEYS.all, 'templates'],
    constraints: () => [...AGENT_KEYS.all, 'constraints'],
    profiles: () => [...AGENT_KEYS.all, 'profiles'],
};

export function useAgentsList(mode) {
    return useQuery({
        queryKey: AGENT_KEYS.lists(mode),
        queryFn: () => pipelineApi.getAgents(mode || 'novel').then(r => r.data),
    });
}

export function useAgentDetail(type, mode, projectId) {
    return useQuery({
        queryKey: AGENT_KEYS.detail(type, mode, projectId),
        queryFn: () => pipelineApi.getAgent(type, mode || 'novel', projectId || '').then(r => r.data),
        enabled: !!type,
    });
}

export function useUpdateAgentPrompt() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, data }) => agentsApi.updatePrompt(type, data).then(r => r.data),
        onSuccess: (_, variables) => {
            const { type, data } = variables;
            const mode = data.mode || 'novel';
            const projectId = data.projectId || '';
            qc.invalidateQueries({ queryKey: AGENT_KEYS.detail(type, mode, projectId) });
            qc.invalidateQueries({ queryKey: AGENT_KEYS.lists(mode) });
        },
    });
}

export function useAgentTemplates() {
    return useQuery({
        queryKey: AGENT_KEYS.templates(),
        queryFn: () => promptConfigApi.listAgentTemplates().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}

export function useUpdateAgentTemplate(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => promptConfigApi.updateAgentTemplate(id, data).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_KEYS.templates() }),
    });
}

export function useAgentConstraints() {
    return useQuery({
        queryKey: AGENT_KEYS.constraints(),
        queryFn: () => promptConfigApi.listConstraintPresets().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}

export function useAgentProfiles() {
    return useQuery({
        queryKey: AGENT_KEYS.profiles(),
        queryFn: () => promptConfigApi.listStyleProfiles().then(r => r.data),
        staleTime: 5 * 60 * 1000,
    });
}
