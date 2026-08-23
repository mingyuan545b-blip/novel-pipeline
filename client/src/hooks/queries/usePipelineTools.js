import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, optimizerApi, projectsApi } from '../../services/api';
import { PIPELINE_KEYS } from './usePipelineStatus';

export function usePipelineAgents() {
    return useQuery({
        queryKey: PIPELINE_KEYS.agents(),
        queryFn: () => pipelineApi.getAgents().then(r => r.data),
    });
}

export function usePipelineOutputPaths(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.outputPaths(projectId),
        queryFn: () => pipelineApi.getOutputPaths(projectId).then(r => r.data),
        enabled: false,
    });
}

export function useChapterImages(projectId, chapterId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.chapterImages(projectId, chapterId),
        queryFn: () => pipelineApi.getChapterImages(projectId, chapterId).then(r => r.data),
        enabled: !!projectId && !!chapterId,
    });
}

export function usePipelineContextBudget(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.contextBudget(projectId),
        queryFn: () => pipelineApi.getContextBudget(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineInjectionMap(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.injectionMap(projectId),
        queryFn: () => pipelineApi.getInjectionMap(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineHookBudget(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.hookBudget(projectId),
        queryFn: () => pipelineApi.getHookBudget(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineRuleStack(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.ruleStack(projectId),
        queryFn: () => pipelineApi.getRuleStack(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineChapterIntent(projectId, chapterNumber) {
    return useQuery({
        queryKey: PIPELINE_KEYS.chapterIntent(projectId),
        queryFn: () => pipelineApi.getChapterIntent(projectId, chapterNumber).then(r => r.data),
        enabled: !!projectId && !!chapterNumber,
    });
}

export function usePipelinePromptAudit(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.promptAudit(projectId),
        queryFn: () => pipelineApi.getPromptAudit(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineOptimizer(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.optimizer(projectId),
        queryFn: () => optimizerApi.report(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function usePipelineApplyOptimizer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (projectId) => optimizerApi.apply(projectId).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_KEYS.all }),
    });
}

export function usePipelineAgentModelConfig(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.agentModelConfig(projectId),
        queryFn: () => pipelineApi.getAgentModelConfig(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useSaveAgentModelConfig(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (config) => pipelineApi.saveAgentModelConfig(projectId, config).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_KEYS.agentModelConfig(projectId) }),
    });
}

export function useChapterAuditData(projectId) {
    return useQuery({
        queryKey: PIPELINE_KEYS.auditData(projectId),
        queryFn: () => pipelineApi.getChapterAuditData(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useRepairModels() {
    return useQuery({
        queryKey: PIPELINE_KEYS.repairModels(),
        queryFn: () => pipelineApi.getRepairModels().then(r => r.data),
    });
}

export function useGetAgentModelConfig(projectId) {
    return useQuery({
        queryKey: [...PIPELINE_KEYS.all, 'agent-model-config', projectId],
        queryFn: () => projectsApi.getAgentModelConfig(projectId).then(r => r.data),
        enabled: !!projectId,
    });
}

export function useSaveAgentModelConfigFromProjects(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (config) => projectsApi.saveAgentModelConfig(projectId, config).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [...PIPELINE_KEYS.all, 'agent-model-config', projectId] }),
    });
}

export function useGetContextTrace(projectId, chapterNumber) {
    return useQuery({
        queryKey: [...PIPELINE_KEYS.all, 'context-trace', projectId, chapterNumber],
        queryFn: () => pipelineApi.getContextTrace(projectId, chapterNumber).then(r => r.data),
        enabled: !!projectId && !!chapterNumber,
    });
}

export function useGetLatestPromptAudit() {
    return useQuery({
        queryKey: [...PIPELINE_KEYS.all, 'prompt-audit', 'latest'],
        queryFn: () => pipelineApi.getLatestPromptAudit().then(r => r.data),
    });
}

export function useRunOptimizerReport() {
    return useMutation({
        mutationFn: ({ projectId, lastNChapters = 10 }) => optimizerApi.report(projectId, lastNChapters).then(r => r.data),
    });
}

export function useApplyOptimizerPattern() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, patternId, data = {} }) => optimizerApi.apply(projectId, patternId, data).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: PIPELINE_KEYS.optimizer(variables.projectId) });
        },
    });
}

export function useOptimizerSuggestion(projectId, patternId) {
    return useQuery({
        queryKey: [...PIPELINE_KEYS.all, 'optimizer-suggestion', projectId, patternId],
        queryFn: () => optimizerApi.suggestion(projectId, patternId).then(r => r.data),
        enabled: !!projectId && !!patternId,
    });
}
