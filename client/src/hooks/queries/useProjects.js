import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/api';

export const PROJECT_KEYS = {
    all: ['projects'],
    lists: () => [...PROJECT_KEYS.all, 'list'],
    detail: (id) => [...PROJECT_KEYS.all, 'detail', id],
    constraints: () => [...PROJECT_KEYS.all, 'constraints'],
    remediationStatus: (id) => [...PROJECT_KEYS.all, 'remediation', id],
    cleanupStats: (id) => [...PROJECT_KEYS.all, 'cleanup', id],
    agentModelConfig: (id) => [...PROJECT_KEYS.all, 'config', id],
};

export function useProjects() {
    return useQuery({
        queryKey: PROJECT_KEYS.lists(),
        queryFn: () => projectsApi.list().then(r => r.data),
    });
}

export function useProject(id) {
    return useQuery({
        queryKey: PROJECT_KEYS.detail(id),
        queryFn: () => projectsApi.get(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useCreateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => projectsApi.create(data).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
    });
}

export function useUpdateProject(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => projectsApi.update(id, data).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(id) });
            if (variables._invalidateList) qc.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
    });
}

export function useDeleteProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => projectsApi.delete(id).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
    });
}

export function useProjectConstraints() {
    return useQuery({
        queryKey: PROJECT_KEYS.constraints(),
        queryFn: () => projectsApi.getConstraints().then(r => r.data),
    });
}

export function useProjectRemediationStatus(id) {
    return useQuery({
        queryKey: PROJECT_KEYS.remediationStatus(id),
        queryFn: () => projectsApi.getRemediationStatus(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useProjectCleanupStats(id) {
    return useQuery({
        queryKey: PROJECT_KEYS.cleanupStats(id),
        queryFn: () => projectsApi.getCleanupStats(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useProjectAgentModelConfig(id) {
    return useQuery({
        queryKey: PROJECT_KEYS.agentModelConfig(id),
        queryFn: () => projectsApi.getAgentModelConfig(id).then(r => r.data),
        enabled: !!id,
    });
}

export function useSaveAgentModelConfig(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (config) => projectsApi.saveAgentModelConfig(id, config).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.agentModelConfig(id) }),
    });
}

export function useProjectCleanup(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ targets, keepLocked = true }) => projectsApi.cleanup(id, targets, keepLocked).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.all });
            qc.invalidateQueries({ queryKey: ['chapters'] });
        },
    });
}

export function useProjectStyleGuidance(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (guidance) => projectsApi.updateStyleGuidance(id, guidance).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(id) }),
    });
}

export function useProjectRemediate(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ reviewText, autoApply = true }) => projectsApi.remediate(id, reviewText, autoApply).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.remediationStatus(id) });
        },
    });
}

export function useDeleteProjectRemediation(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ type, index }) => projectsApi.deleteRemediation(id, type, index).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_KEYS.remediationStatus(id) }),
    });
}

export function useAnalyzeStyle() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, suggestion }) => projectsApi.analyzeStyle(projectId, suggestion).then(r => r.data),
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(variables.projectId) });
        },
    });
}

export function useRemediate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, reviewText, autoApply }) => projectsApi.remediate(projectId, reviewText, autoApply).then(r => r.data),
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.remediationStatus(variables.projectId) });
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(variables.projectId) });
            qc.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
    });
}
