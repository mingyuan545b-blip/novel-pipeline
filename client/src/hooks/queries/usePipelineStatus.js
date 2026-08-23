import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '../../services/api';

export const PIPELINE_KEYS = {
    all: ['pipeline'],
    status: (projectId) => [...PIPELINE_KEYS.all, 'status', projectId],
    agents: () => [...PIPELINE_KEYS.all, 'agents'],
    outputPaths: (projectId) => [...PIPELINE_KEYS.all, 'output-paths', projectId],
    chapterImages: (projectId, chapterId) => [...PIPELINE_KEYS.all, 'images', projectId, chapterId],
    contextBudget: (projectId) => [...PIPELINE_KEYS.all, 'budget', projectId],
    injectionMap: (projectId) => [...PIPELINE_KEYS.all, 'injection', projectId],
    hookBudget: (projectId) => [...PIPELINE_KEYS.all, 'hook-budget', projectId],
    ruleStack: (projectId) => [...PIPELINE_KEYS.all, 'rule-stack', projectId],
    chapterIntent: (projectId) => [...PIPELINE_KEYS.all, 'intent', projectId],
    promptAudit: (projectId) => [...PIPELINE_KEYS.all, 'prompt-audit', projectId],
    optimizer: (projectId) => [...PIPELINE_KEYS.all, 'optimizer', projectId],
    agentModelConfig: (projectId) => [...PIPELINE_KEYS.all, 'agent-model-config', projectId],
    auditData: (projectId) => [...PIPELINE_KEYS.all, 'audit-data', projectId],
    repairModels: () => [...PIPELINE_KEYS.all, 'repair-models'],
};

export function usePipelineStatus(projectId, { refetchInterval = 3000, refetchIntervalInBackground = true } = {}) {
    return useQuery({
        queryKey: PIPELINE_KEYS.status(projectId),
        queryFn: () => pipelineApi.getInfiniteStatus(projectId).then(r => r.data),
        enabled: !!projectId,
        refetchInterval,
        refetchIntervalInBackground,
    });
}

export function useStartPipeline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.startInfinite(data).then(r => r.data),
        onSuccess: (_, variables) => qc.invalidateQueries({ queryKey: PIPELINE_KEYS.status(variables.projectId) }),
    });
}

export function useStopPipeline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (projectId) => pipelineApi.stopInfinite({ projectId }).then(r => r.data),
        onSuccess: (_, projectId) => qc.invalidateQueries({ queryKey: PIPELINE_KEYS.status(projectId) }),
    });
}

export function useResetPipeline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (projectId) => pipelineApi.resetInfinite({ projectId }).then(r => r.data),
        onSuccess: (_, projectId) => qc.invalidateQueries({ queryKey: PIPELINE_KEYS.status(projectId) }),
    });
}

export function useTaskStatusPoll(taskId, { refetchInterval = 3000, refetchIntervalInBackground = true, enabled = true } = {}) {
    return useQuery({
        queryKey: [...PIPELINE_KEYS.all, 'task-status', taskId],
        queryFn: () => pipelineApi.getTaskStatus(taskId).then(r => r.data),
        enabled: enabled && !!taskId,
        refetchInterval,
        refetchIntervalInBackground,
    });
}
