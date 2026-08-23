import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, chapterAuditApi, projectsApi } from '../../services/api';
import { PIPELINE_KEYS } from './usePipelineStatus';

export function useRunPipeline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.runFull(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
        },
    });
}
export function useRunSingleChapter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ chapterId, projectId }) => pipelineApi.runStep({ chapterId, projectId }).then(r => r.data),
        onSuccess: (data) => {
            if (data.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', data.projectId] });
        },
    });
}
export function useRetryChapter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ chapterId, projectId }) => pipelineApi.runStep({ chapterId, projectId, retry: true }).then(r => r.data),
        onSuccess: (data) => {
            if (data.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', data.projectId] });
        },
    });
}
export function useBatchRetryChapters() {
    return useMutation({
        mutationFn: ({ chapterIds, projectId }) => {
            const promises = chapterIds.map(chapterId =>
                pipelineApi.runStep({ chapterId, projectId, retry: true }).then(r => r.data)
            );
            return Promise.all(promises);
        },
    });
}
export function useSupplementOutlines() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.supplementOutlines(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
        },
    });
}
export function useRerunMaterialManager() {
    return useMutation({
        mutationFn: ({ projectId, chapterIds }) => pipelineApi.rerunMaterialManager(projectId, chapterIds).then(r => r.data),
    });
}
export function useToggleMaterialLock() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.toggleMaterialLock(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: PIPELINE_KEYS.injectionMap(variables.projectId) });
        },
    });
}
export function useSetVolumeSubplane() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.setVolumeSubplane(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: PIPELINE_KEYS.injectionMap(variables.projectId) });
        },
    });
}
export function useGenerateSubplaneMaterials() {
    return useMutation({
        mutationFn: (data) => pipelineApi.generateSubplaneMaterials(data).then(r => r.data),
    });
}
export function useClearChaptersAfter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, afterChapter }) => pipelineApi.clearChaptersAfter(projectId, afterChapter).then(r => r.data),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
        },
    });
}
export function useResetChapterContent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.resetChapterContent(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
        },
    });
}
export function useResetChaptersBulk() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.resetChaptersBulk(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
        },
    });
}
export function useRunStep() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.runStep(data).then(r => r.data),
        onSuccess: (_, variables) => {
            if (variables.projectId) {
                qc.invalidateQueries({ queryKey: ['chapters', 'list', variables.projectId] });
                qc.invalidateQueries({ queryKey: PIPELINE_KEYS.outputPaths(variables.projectId) });
            }
        },
    });
}
export function useRunFullPipeline() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => pipelineApi.runFull(data).then(r => r.data),
        onSuccess: (data) => {
            if (data.projectId) {
                qc.invalidateQueries({ queryKey: ['chapters', 'list', data.projectId] });
                qc.invalidateQueries({ queryKey: PIPELINE_KEYS.outputPaths(data.projectId) });
            }
        },
    });
}
export function useRepairChapter() {
    return useMutation({
        mutationFn: ({ chapterId, data }) => chapterAuditApi.repair(data.projectId, chapterId, data).then(r => r.data),
    });
}
export function useBatchRepairChapters() {
    return useMutation({
        mutationFn: ({ projectId, data }) => chapterAuditApi.batchRepair(projectId, data).then(r => r.data),
    });
}
export function useSaveProjectTargets(projectId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (targets) => projectsApi.saveTargets(projectId, targets).then(r => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', 'detail', projectId] }),
    });
}
export function useTestAgentConnection() {
    return useMutation({
        mutationFn: (config) => projectsApi.testConnection(config).then(r => r.data),
    });
}
export function useTestAgentModel() {
    return useMutation({
        mutationFn: ({ provider, model, apiKey }) => pipelineApi.testAgentModel({ provider, model, apiKey }).then(r => r.data),
    });
}
export function useSyncHookBudget(projectId) {
    return useMutation({
        mutationFn: () => pipelineApi.syncHookBudget(projectId).then(r => r.data),
    });
}
export function useExtractRuleStack(projectId) {
    return useMutation({
        mutationFn: () => pipelineApi.extractRuleStack(projectId).then(r => r.data),
    });
}
export function useRegisterHook(projectId) {
    return useMutation({
        mutationFn: (data) => pipelineApi.registerHook(projectId, data).then(r => r.data),
    });
}
