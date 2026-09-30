import { api, longApi } from './httpClient';

export const pipelineApi = {
    runStep: (data) => longApi.post('/pipeline/step', data),
    runFull: (data) => api.post('/pipeline/full', data),
    generateMaterials: (data) => longApi.post('/pipeline/generate-materials', data),
    generateOutlines: (data) => longApi.post('/pipeline/generate-outlines', data),
    generateFromTemplate: (data) => api.post('/pipeline/generate-from-template', data),
    getTaskStatus: (taskId) => api.get(`/pipeline/task/${taskId}`),
    startInfinite: (data) => longApi.post('/pipeline/infinite', data),
    stopInfinite: (data) => longApi.post('/pipeline/infinite/stop', data),
    resetInfinite: (data) => api.post('/pipeline/infinite/reset', data),
    getInfiniteStatus: (projectId) => longApi.get(`/pipeline/infinite/status/${projectId}`),
    // 运行看板：进度/当前步骤/Agent 耗时（一个端点取齐，避免多请求时序不一致）
    getProgress: (projectId) => api.get(`/pipeline/progress/${projectId}`),
    resetChapterContent: (data) => api.post('/pipeline/reset-chapter-content', data),
    resetChaptersBulk: (data) => api.post('/pipeline/reset-chapters-bulk', data),
    supplementOutlines: (data) => longApi.post('/pipeline/supplement-outlines', data),
    getOutlines: (projectId) => api.get(`/pipeline/outlines/${projectId}`),
    getOutlineInjectionMap: (projectId) => api.get(`/pipeline/injection-map/${projectId}`),
    toggleMaterialLock: (data) => api.post('/pipeline/toggle-material-lock', data),
    setVolumeSubplane: (data) => api.post('/pipeline/set-volume-subplane', data),
    generateSubplaneMaterials: (data) => longApi.post('/pipeline/generate-subplane-materials', data),
    getOutputPaths: (projectId, chapterId) => api.get(`/pipeline/output-paths/${projectId}/${chapterId}`),
    getAgents: (mode) => api.get('/pipeline/agents', { params: { mode: mode || 'novel' } }),
    getAgent: (type, mode, projectId) => api.get(`/pipeline/agents/${type}`, { params: { mode: mode || 'novel', projectId: projectId || '' } }),
    getContextBudget: (projectId) => api.get(`/pipeline/context-budget/${projectId}`),
    getHookBudget: (projectId, chapter) => api.get(`/pipeline/hook-budget/${projectId}`, { params: { chapter: chapter || 0 } }),
    getRuleStack: (projectId, context) => api.get(`/pipeline/rule-stack/${projectId}`, { params: { context: context || 'writer' } }),
    getChapterIntent: (projectId, chapterNumber) => api.get(`/pipeline/chapter-intent/${projectId}/${chapterNumber}`),
    getContextTrace: (projectId, chapterNumber) => api.get(`/pipeline/context-trace/${projectId}/${chapterNumber}`),
    registerHook: (projectId, data) => api.post(`/pipeline/hook-budget/${projectId}/register`, data),
    syncHookBudget: (projectId) => api.post(`/pipeline/hook-budget/${projectId}/sync`),
    extractRuleStack: (projectId) => api.post(`/pipeline/rule-stack/${projectId}/extract`),
    rerunMaterialManager: (projectId, chapterIds) => api.post(`/pipeline/rerun-material-manager/${projectId}`, { chapterIds }),
    clearChaptersAfter: (projectId, afterChapter) => api.post(`/pipeline/clear-chapters-after/${projectId}`, { afterChapter }),
    getPipelineLogs: (projectId, chapterId) => api.get(`/pipeline/pipeline-logs/${projectId}/${chapterId}`),
    getAllPipelineLogs: (projectId) => api.get(`/pipeline/pipeline-logs/${projectId}`),
    getPromptAudit: (projectId, mode) => api.get(`/pipeline/prompt-audit/${projectId}`, { params: { mode: mode || 'novel' } }),
    getLatestPromptAudit: () => api.get('/pipeline/prompt-audit-latest'),
    getConsistencyConstraints: (projectId, { chapterNumber, activeOnly } = {}) =>
        api.get(`/pipeline/consistency-constraints/${projectId}`, { params: { chapterNumber, activeOnly } }),
    resolveConsistencyConstraint: (constraintId, resolvedBy) =>
        api.post(`/pipeline/consistency-constraints/${constraintId}/resolve`, { resolvedBy }),
    getChronicle: (projectId, { entityId, fromChapter, toChapter } = {}) =>
        api.get(`/pipeline/chronicle/${projectId}`, { params: { entityId, fromChapter, toChapter } }),
    getChronicleForEntity: (projectId, entityId, { fromChapter, toChapter } = {}) =>
        api.get(`/pipeline/chronicle/${projectId}/${entityId}`, { params: { fromChapter, toChapter } }),
    extractChronicle: (projectId, { chapterNumbers, level } = {}) =>
        api.post(`/pipeline/chronicle/${projectId}/extract`, { chapterNumbers, level }),

    getWorldScope: (projectId) =>
        api.get(`/pipeline/worldscope/${projectId}`),
    getWorldScopeForEntity: (projectId, entityId) =>
        api.get(`/pipeline/worldscope/${projectId}/entity/${entityId}`),
    saveWorldScopeWorlds: (projectId, worlds) =>
        api.post(`/pipeline/worldscope/${projectId}/worlds`, { worlds }),
    extractWorldScope: (projectId, { chapterNumbers, level } = {}) =>
        api.post(`/pipeline/worldscope/${projectId}/extract`, { chapterNumbers, level }),

    // 跨世界物品溯源
    getCrossWorldTraces: (projectId, filters = {}) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v) qs.append(k, v);
        }
        const query = qs.toString();
        return api.get(`/pipeline/worldscope/${projectId}/traces${query ? `?${query}` : ''}`);
    },
    getCrossWorldTrace: (projectId, traceId) =>
        api.get(`/pipeline/worldscope/${projectId}/traces/${traceId}`),
    createCrossWorldTrace: (projectId, payload) =>
        api.post(`/pipeline/worldscope/${projectId}/traces`, payload),
    addCrossWorldTraceEvent: (projectId, traceId, event) =>
        api.post(`/pipeline/worldscope/${projectId}/traces/${traceId}/events`, event),
    updateCrossWorldTrace: (projectId, traceId, patch) =>
        api.put(`/pipeline/worldscope/${projectId}/traces/${traceId}`, patch),
    deleteCrossWorldTrace: (projectId, traceId) =>
        api.delete(`/pipeline/worldscope/${projectId}/traces/${traceId}`),

    getContextPreview: (projectId, data) => api.post(`/pipeline/context-preview/${projectId}`, data),
    getContextOverrides: (projectId) => api.get(`/pipeline/context-overrides/${projectId}`),
    setContextOverride: (projectId, data) => api.post(`/pipeline/context-overrides/${projectId}`, data),
    deleteContextOverride: (overrideId) => api.delete(`/pipeline/context-overrides/${overrideId}`),
    // 上下文装配图：本章各Agent实际装配了哪些素材/层级/信息密度，以及数据源流通状态
    getContextAssembly: (projectId, chapterNumber, agentType) => api.get(
        `/pipeline/context-assembly/${projectId}`,
        { params: { chapterNumber: chapterNumber || '', agentType: agentType || '' } }
    ),
    // Token 去向面板：每章每步花了多少 token、花在哪几段提示词、哪段被截断
    getTokenLedger: (projectId) => api.get(`/pipeline/token-ledger/${projectId}`),
    getTokenLedgerChapter: (projectId, chapterNumber) =>
        api.get(`/pipeline/token-ledger/${projectId}/chapter/${chapterNumber}`),
};

export const genreDebugApi = {
    listGenres: () => api.get('/genre-debug/list'),
    getGenreAgents: (genreId) => api.get(`/genre-debug/${genreId}/agents`),
    getAgentPrompt: (genreId, agentType) => api.get(`/genre-debug/${genreId}/${agentType}/prompt`),
    getConstraints: (genreId) => api.get(`/genre-debug/${genreId}/constraints`),
    updateConstraints: (genreId, data) => api.put(`/genre-debug/${genreId}/constraints`, data),
    getConstraintModules: () => api.get('/genre-debug/constraint-modules'),
    getAgentConstraintModules: (agentType) => api.get(`/genre-debug/constraint-modules/${agentType}`)
};

export const optimizerApi = {
    report: (projectId, lastNChapters = 10) => api.get(`/optimizer/report/${projectId}`, { params: { lastNChapters } }),
    suggestion: (projectId, patternId) => api.get(`/optimizer/suggestion/${projectId}/${patternId}`),
    apply: (projectId, patternId, data = {}) => api.post(`/optimizer/apply/${projectId}/${patternId}`, data)
};
