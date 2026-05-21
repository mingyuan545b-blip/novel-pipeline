/**
 * API服务层 - 封装所有后端API调用
 *
 * 使用两个axios实例：
 * - api: 普通请求，30秒超时（CRUD操作）
 * - longApi: 长超时请求，10分钟超时（AI生成/流水线执行）
 *
 * 所有API通过Vite代理转发到后端(http://localhost:3001/api)
 * 开发环境无需处理跨域问题
 */
import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' }
});

const longApi = axios.create({
    baseURL: API_BASE,
    timeout: 600000,
    headers: { 'Content-Type': 'application/json' }
});

const AUTH_TOKEN = import.meta.env.VITE_REQUEST_SECRET || localStorage.getItem('request_secret') || '';

function addAuthInterceptor(instance) {
    instance.interceptors.request.use(config => {
        const token = AUTH_TOKEN || localStorage.getItem('request_secret') || '';
        if (token && !config.url?.includes('/health')) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    });
    instance.interceptors.response.use(
        response => response,
        error => {
            if (error.response?.status === 401) {
                console.warn('[API] Authentication required. Set VITE_REQUEST_SECRET in .env or localStorage.request_secret');
            } else if (error.response?.status === 403) {
                console.warn('[API] Access forbidden:', error.response?.data?.error || 'Permission denied');
            } else if (error.response?.status === 409) {
                console.warn('[API] Conflict:', error.response?.data?.error || 'Resource conflict');
            } else if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
                console.warn('[API] Request timeout or cancelled:', error.config?.url);
            } else if (!error.response) {
                console.warn('[API] Network error - server may be offline');
            } else if (error.response?.status >= 500) {
                console.error('[API] Server error:', error.response?.status, error.response?.data?.error);
            }
            return Promise.reject(error);
        }
    );
}

addAuthInterceptor(api);
addAuthInterceptor(longApi);

export const projectsApi = {
    list: () => api.get('/projects'),
    get: (id) => api.get(`/projects/${id}`),
    create: (data) => api.post('/projects', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    getConstraints: () => api.get('/projects/constraints'),
    getRelationshipGraph: (id) => api.get(`/projects/${id}/relationship-graph`),
    analyzeStyle: (id, suggestion) => longApi.post(`/projects/${id}/analyze-style`, { suggestion }),
    updateStyleGuidance: (id, guidance) => api.put(`/projects/${id}/style-guidance`, { styleGuidance: guidance }),
    remediate: (id, reviewText, autoApply = true) => longApi.post(`/projects/${id}/remediate`, { reviewText, autoApply }),
    getRemediationStatus: (id) => api.get(`/projects/${id}/remediation-status`),
    deleteRemediation: (id, type, index) => api.delete(`/projects/${id}/remediation/${type}`, { data: { index } }),
    resetChapters: (id, options = {}) => api.post(`/projects/${id}/reset-chapters`, options),
    getCleanupStats: (id) => api.get(`/projects/${id}/cleanup-stats`),
    cleanup: (id, targets, keepLocked = true) => api.post(`/projects/${id}/cleanup`, { targets, keepLocked }),
    getAgentModelConfig: (id) => api.get(`/projects/${id}/agent-model-config`),
    saveAgentModelConfig: (id, config) => api.put(`/projects/${id}/agent-model-config`, config),
    saveTargets: (id, targets) => api.put(`/projects/${id}/targets`, targets),
    testConnection: (config) => api.post('/projects/test-connection', config)
};

export const chaptersApi = {
    list: (params) => api.get('/chapters', { params }),
    get: (id) => api.get(`/chapters/${id}`),
    create: (data) => api.post('/chapters', data),
    update: (id, data) => api.put(`/chapters/${id}`, data),
    delete: (id) => api.delete(`/chapters/${id}`),
    reset: (id) => api.post(`/chapters/${id}/reset`),
    downloadNovel: (projectId) => api.get(`/chapters/download-novel/${projectId}`, { responseType: 'blob' })
};

export const materialsApi = {
    list: (params) => api.get('/materials', { params }),
    get: (id) => api.get(`/materials/${id}`),
    create: (data) => api.post('/materials', data),
    update: (id, data) => api.put(`/materials/${id}`, data),
    delete: (id) => api.delete(`/materials/${id}`),
    getTypes: () => api.get('/materials/types')
};

export const reviewsApi = {
    list: (params) => api.get('/reviews', { params }),
    get: (id) => api.get(`/reviews/${id}`),
    create: (data) => api.post('/reviews', data),
    update: (id, data) => api.put(`/reviews/${id}`, data),
    delete: (id) => api.delete(`/reviews/${id}`)
};

export const styleTemplateApi = {
    listTemplates: (params) => api.get('/style-templates/templates', { params }),
    getTemplate: (id) => api.get(`/style-templates/templates/${id}`),
    createTemplate: (data) => api.post('/style-templates/templates', data),
    updateTemplate: (id, data) => api.put(`/style-templates/templates/${id}`, data),
    deleteTemplate: (id) => api.delete(`/style-templates/templates/${id}`),
    analyze: (data) => longApi.post('/style-templates/analyze', data),
    importDirect: (data) => api.post('/style-templates/import-direct', data),
    learnFromChapter: (data) => longApi.post('/style-templates/learn-from-chapter', data),
    applyToProject: (data) => api.post('/style-templates/apply-to-project', data)
};

export const pipelineApi = {
    runStep: (data) => longApi.post('/pipeline/step', data),
    runFull: (data) => api.post('/pipeline/full', data),
    generateMaterials: (data) => longApi.post('/pipeline/generate-materials', data),
    generateOutlines: (data) => longApi.post('/pipeline/generate-outlines', data),
    generateFromTemplate: (data) => api.post('/pipeline/generate-from-template', data),
    shuangwenOneClick: (data) => api.post('/pipeline/shuangwen-oneclick', data),
    getTaskStatus: (taskId) => api.get(`/pipeline/task/${taskId}`),
    startInfinite: (data) => longApi.post('/pipeline/infinite', data),
    stopInfinite: (data) => longApi.post('/pipeline/infinite/stop', data),
    resetInfinite: (data) => api.post('/pipeline/infinite/reset', data),
    getInfiniteStatus: (projectId) => longApi.get(`/pipeline/infinite/status/${projectId}`),
    resetChapterContent: (data) => api.post('/pipeline/reset-chapter-content', data),
    resetChaptersBulk: (data) => api.post('/pipeline/reset-chapters-bulk', data),
    supplementOutlines: (data) => longApi.post('/pipeline/supplement-outlines', data),
    getOutlineInjectionMap: (projectId) => api.get(`/pipeline/injection-map/${projectId}`),
    toggleMaterialLock: (data) => api.post('/pipeline/toggle-material-lock', data),
    setVolumeSubplane: (data) => api.post('/pipeline/set-volume-subplane', data),
    generateSubplaneMaterials: (data) => longApi.post('/pipeline/generate-subplane-materials', data),
    getOutputPaths: (projectId, chapterId) => api.get(`/pipeline/output-paths/${projectId}/${chapterId}`),
    getAgents: (mode) => api.get('/pipeline/agents', { params: { mode: mode || 'novel' } }),
    getAgent: (type, mode, projectId) => api.get(`/pipeline/agents/${type}`, { params: { mode: mode || 'novel', projectId: projectId || '' } }),
    generateImages: (data) => longApi.post('/pipeline/generate-images', data),
    getImages: (projectId) => api.get(`/pipeline/images/${projectId}`),
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
    getLatestPromptAudit: () => api.get('/pipeline/prompt-audit-latest')
};

export const agentsApi = {
    list: () => api.get('/agents'),
    get: (type, params) => api.get(`/agents/${type}`, { params }),
    updateManifest: (type, data) => api.put(`/agents/${type}/manifest`, data),
    updateServer: (type, data) => api.put(`/agents/${type}/server`, data),
    updatePrompt: (type, data) => api.put(`/agents/${type}/prompt`, data)
};

export const promptConfigApi = {
    listAgentTemplates: (params) => api.get('/prompt-config/agent-templates', { params }),
    getAgentTemplate: (id) => api.get(`/prompt-config/agent-templates/${id}`),
    createAgentTemplate: (data) => api.post('/prompt-config/agent-templates', data),
    updateAgentTemplate: (id, data) => api.put(`/prompt-config/agent-templates/${id}`, data),
    deleteAgentTemplate: (id) => api.delete(`/prompt-config/agent-templates/${id}`),
    listStyleProfiles: () => api.get('/prompt-config/style-profiles'),
    getStyleProfile: (id) => api.get(`/prompt-config/style-profiles/${id}`),
    getStyleProfileByKey: (key) => api.get(`/prompt-config/style-profiles/key/${key}`),
    createStyleProfile: (data) => api.post('/prompt-config/style-profiles', data),
    updateStyleProfile: (id, data) => api.put(`/prompt-config/style-profiles/${id}`, data),
    deleteStyleProfile: (id) => api.delete(`/prompt-config/style-profiles/${id}`),
    listConstraintPresets: (params) => api.get('/prompt-config/constraint-presets', { params }),
    getConstraintPreset: (id) => api.get(`/prompt-config/constraint-presets/${id}`),
    createConstraintPreset: (data) => api.post('/prompt-config/constraint-presets', data),
    updateConstraintPreset: (id, data) => api.put(`/prompt-config/constraint-presets/${id}`, data),
    deleteConstraintPreset: (id) => api.delete(`/prompt-config/constraint-presets/${id}`),
    listFoundationPrompts: () => api.get('/prompt-config/foundation-prompts'),
    getFoundationPrompt: (id) => api.get(`/prompt-config/foundation-prompts/${id}`),
    getResolvedPrompt: (params) => api.get('/prompt-config/resolved-prompt', { params })
};

export const settingsApi = {
    get: () => api.get('/settings'),
    save: (data) => api.post('/settings', data),
    test: () => longApi.post('/settings/test')
};

export const guideApi = {
    getAll: () => api.get('/guide'),
    getQuickStart: () => api.get('/guide/quick-start'),
    getAipyPro: () => api.get('/guide/aipy-pro'),
    getPipelineFlow: () => api.get('/guide/pipeline-flow'),
    getAgentRoles: () => api.get('/guide/agent-roles')
};

export const workshopApi = {
    importSettingText: (data) => longApi.post('/workshop/import-setting-text', data),
    importSettingFiles: (formData) => longApi.post('/workshop/import-setting', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    generateMaterials: (data) => longApi.post('/workshop/generate-materials', data),
    generateOutlines: (data) => longApi.post('/workshop/generate-outlines', data),
    fuseNovelsText: (data) => longApi.post('/workshop/fuse-novels-text', data),
    fuseNovelsFiles: (formData) => longApi.post('/workshop/fuse-novels', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    validateTemplate: (template) => api.post('/workshop/validate-template', template),
    importTemplate: (template, options = {}) => api.post('/workshop/import-template', { template, ...options }),
    importTemplateFile: (formData) => api.post('/workshop/import-template-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    exportTemplate: (projectId) => api.get(`/workshop/export-template/${projectId}`)
};

export const publishApi = {
    getPlatforms: () => api.get('/publish/platforms'),
    getPlatform: (id) => api.get(`/publish/platforms/${id}`),
    getAccounts: (projectId) => api.get('/publish/accounts', { params: { projectId } }),
    addAccount: (data) => api.post('/publish/accounts', data),
    updateAccount: (id, data) => api.put(`/publish/accounts/${id}`, data),
    deleteAccount: (id) => api.delete(`/publish/accounts/${id}`),
    verifyAccount: (id) => api.post(`/publish/accounts/${id}/verify`),
    getQueue: (projectId) => api.get('/publish/queue', { params: { projectId } }),
    addToQueue: (data) => api.post('/publish/queue', data),
    batchAddToQueue: (data) => api.post('/publish/queue/batch', data),
    updateQueueItem: (id, data) => api.put(`/publish/queue/${id}`, data),
    deleteQueueItem: (id) => api.delete(`/publish/queue/${id}`),
    formatContent: (data) => api.post('/publish/format', data),
    getPublishStats: (projectId) => api.get('/publish/stats/publish', { params: { projectId } }),
    getInteractions: (projectId, filter) => api.get('/publish/interactions', { params: { projectId, ...filter } }),
    addInteraction: (data) => api.post('/publish/interactions', data),
    batchAddInteractions: (data) => api.post('/publish/interactions/batch', data),
    updateInteraction: (id, data) => api.put(`/publish/interactions/${id}`, data),
    deleteInteraction: (id) => api.delete(`/publish/interactions/${id}`),
    getInteractionStats: (projectId) => api.get('/publish/stats/interactions', { params: { projectId } }),
    fanqiePublish: (data) => api.post('/publish/fanqie/publish', data),
    fanqieStop: () => api.post('/publish/fanqie/stop'),
    fanqieStatus: () => api.get('/publish/fanqie/status'),
    fanqieCloseBrowser: () => api.post('/publish/fanqie/close-browser'),
    fanqieCheckLogin: (cdpUrl) => api.post('/publish/fanqie/check-login', { cdpUrl }),
    fanqieOpenWriter: (cdpUrl) => api.post('/publish/fanqie/open-writer', { cdpUrl }),
    fanqieOpenEditor: (cdpUrl, bookId) => api.post('/publish/fanqie/open-editor', { cdpUrl, bookId }),
    multiGetPlatforms: () => api.get('/publish/multi-platforms'),
    multiPublish: (data) => api.post('/publish/multi-publish', data),
    multiStop: (platform) => api.post('/publish/multi-stop', { platform }),
    multiGetStatus: (platform) => api.get(`/publish/multi-status/${platform}`),
    multiGetAllStatus: () => api.get('/publish/multi-status'),
    multiCloseBrowser: (platform) => api.post('/publish/multi-close-browser', { platform }),
    multiCheckLogin: (platform, cdpUrl) => api.post('/publish/multi-check-login', { platform, cdpUrl }),
    multiOpenWriter: (platform, cdpUrl) => api.post('/publish/multi-open-writer', { platform, cdpUrl }),
    multiOpenEditor: (platform, cdpUrl, bookId) => api.post('/publish/multi-open-editor', { platform, cdpUrl, bookId }),
    multiUpdate: (data) => api.post('/publish/multi-update', data)
};

export const mapApi = {
    getLevels: () => api.get('/map/levels'),
    getRoot: (projectId) => api.get('/map/root', { params: { projectId } }),
    getTree: (projectId) => api.get('/map/tree', { params: { projectId } }),
    getNode: (id, projectId) => api.get(`/map/node/${id}`, { params: { projectId } }),
    getChildren: (parentId, projectId) => api.get(`/map/children/${parentId}`, { params: { projectId } }),
    createNode: (data) => api.post('/map/node', data),
    updateNode: (id, data) => api.put(`/map/node/${id}`, data),
    deleteNode: (id, params) => api.delete(`/map/node/${id}`, { params }),
    batchCreate: (data) => api.post('/map/batch', data),
    getFactionTerritories: (factionId, projectId) => api.get(`/map/faction/${factionId}`, { params: { projectId } }),
    importMaterials: (data) => api.post('/map/import-materials', data)
};

export const worldviewProfileApi = {
    list: () => api.get('/worldview-profiles'),
    get: (id) => api.get(`/worldview-profiles/${id}`),
    create: (data) => api.post('/worldview-profiles', data),
    update: (id, data) => api.put(`/worldview-profiles/${id}`, data),
    delete: (id) => api.delete(`/worldview-profiles/${id}`),
    apply: (id, projectId) => api.post(`/worldview-profiles/${id}/apply/${projectId}`),
    saveFromProject: (projectId, data) => api.post(`/worldview-profiles/save-from-project/${projectId}`, data)
};

export const comicApi = {
    getConfig: () => api.get('/comic/config'),
    saveConfig: (data) => api.post('/comic/config', data),
    testConnection: (data) => longApi.post('/comic/test-connection', data),
    getWorkflows: (projectId) => api.get('/comic/workflows', { params: { projectId } }),
    getWorkflow: (id) => api.get(`/comic/workflows/${id}`),
    createWorkflow: (data) => api.post('/comic/workflows', data),
    uploadWorkflow: (formData) => api.post('/comic/workflows/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    updateWorkflow: (id, data) => api.put(`/comic/workflows/${id}`, data),
    deleteWorkflow: (id) => api.delete(`/comic/workflows/${id}`),
    getStoryboards: (projectId) => api.get('/comic/storyboards', { params: { projectId } }),
    createStoryboard: (data) => api.post('/comic/storyboards', data),
    updateStoryboard: (id, data) => api.put(`/comic/storyboards/${id}`, data),
    deleteStoryboard: (id) => api.delete(`/comic/storyboards/${id}`),
    renderStoryboard: (id) => api.post(`/comic/storyboards/${id}/render`),
    batchRender: (ids) => api.post('/comic/storyboards/batch-render', { ids }),
    getRenderQueue: (projectId) => api.get('/comic/render-queue', { params: { projectId } }),
    cancelRender: (id) => api.post(`/comic/render-queue/${id}/cancel`),
    retryRender: (id) => api.post(`/comic/render-queue/${id}/retry`),
    clearCompleted: (projectId) => api.post('/comic/render-queue/clear', { projectId }),
    startComfyUI: () => api.post('/comic/start-comfyui'),
    stopComfyUI: () => api.post('/comic/stop-comfyui'),
    getComfyUIStatus: () => api.get('/comic/comfyui-status'),
    getTTSVoices: () => api.get('/comic/tts/voices'),
    synthesizeTTS: (data) => api.post('/comic/tts/synthesize', data),
    synthesizeTTSBatch: (data) => longApi.post('/comic/tts/synthesize-batch', data),
    exportEpisode: (data) => longApi.post('/comic/export-episode', data),
    getExportStatus: (projectId) => api.get(`/comic/export-status/${projectId}`),
    comfyuiTextToImage: (data) => longApi.post('/comic/comfyui/text-to-image', data),
    comfyuiImageToVideo: (data) => longApi.post('/comic/comfyui/image-to-video', data),
    comfyuiWan22TextToVideo: (data) => longApi.post('/comic/comfyui/wan22-text-to-video', data),
    comfyuiWan22ImageToVideo: (data) => longApi.post('/comic/comfyui/wan22-image-to-video', data),
    comfyuiUploadImage: (formData) => api.post('/comic/comfyui/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    comfyuiSystemInfo: () => api.get('/comic/comfyui/system-info'),
    comfyuiFreeMemory: (data) => api.post('/comic/comfyui/free-memory', data),
    comfyuiGetAutoFreeConfig: () => api.get('/comic/comfyui/auto-free-config'),
    comfyuiSetAutoFreeConfig: (data) => api.post('/comic/comfyui/auto-free-config', data)
};

export const questApi = {
    listQuests: (params) => api.get('/quests/quests', { params }),
    getQuest: (id) => api.get(`/quests/quests/${id}`),
    createQuest: (data) => api.post('/quests/quests', data),
    updateQuest: (id, data) => api.put(`/quests/quests/${id}`, data),
    deleteQuest: (id) => api.delete(`/quests/quests/${id}`),
    reorderQuests: (data) => api.put('/quests/quests/reorder', data),
    listTimelines: (params) => api.get('/quests/timelines', { params }),
    getTimeline: (id) => api.get(`/quests/timelines/${id}`),
    createTimeline: (data) => api.post('/quests/timelines', data),
    updateTimeline: (id, data) => api.put(`/quests/timelines/${id}`, data),
    deleteTimeline: (id) => api.delete(`/quests/timelines/${id}`),
    reorderTimelines: (data) => api.put('/quests/timelines/reorder', data),
    autoInit: (projectId) => api.post(`/quests/auto-init/${projectId}`),
    getMeta: () => api.get('/quests/meta')
};

export const licenseApi = {
    getStatus: () => api.get('/license/status'),
    activate: (key) => api.post('/license/activate', { key }),
    deactivate: () => api.post('/license/deactivate'),
    startTrial: () => api.post('/license/trial')
};

export const versionApi = {
    getInfo: () => api.get('/version'),
    checkUpdate: (remoteInfo) => api.post('/version/check', remoteInfo)
};

export const healthApi = {
    check: () => api.get('/health')
};

export const knowledgeApi = {
    getOverview: (projectId) => api.get(`/knowledge/overview/${projectId}`),
    getMemoryLayers: (projectId) => api.get(`/knowledge/memory/${projectId}/layers`),
    getMemoryLayer: (projectId, layer) => api.get(`/knowledge/memory/${projectId}/layer/${layer}`),
    buildMemoryLayer: (projectId, layer, data) => api.post(`/knowledge/memory/${projectId}/build/${layer}`, data),
    assembleContext: (projectId, data) => api.post(`/knowledge/memory/${projectId}/assemble`, data),
    getFormattedContext: (projectId, params) => api.get(`/knowledge/memory/${projectId}/formatted-context`, { params }),
    generateVolumeSummary: (projectId, volumeNum) => api.post(`/knowledge/memory/${projectId}/volume-summary/${volumeNum}`),
    createSnapshot: (projectId, data) => api.post(`/knowledge/snapshots/${projectId}`, data),
    getSnapshots: (projectId, params) => api.get(`/knowledge/snapshots/${projectId}`, { params }),
    getLatestSnapshot: (projectId) => api.get(`/knowledge/snapshots/${projectId}/latest`),
    getCharacterTimeline: (projectId, characterId) => api.get(`/knowledge/snapshots/${projectId}/character/${characterId}/timeline`),
    getRelationshipTimeline: (projectId, relationshipId) => api.get(`/knowledge/snapshots/${projectId}/relationship/${relationshipId}/timeline`),
    getPowerProgression: (projectId, characterId) => api.get(`/knowledge/snapshots/${projectId}/power/${characterId}`),
    getForeshadowingTracker: (projectId) => api.get(`/knowledge/snapshots/${projectId}/foreshadowing`),
    restoreSnapshot: (projectId, chapterNumber) => api.post(`/knowledge/snapshots/${projectId}/restore/${chapterNumber}`),
    getSnapshotDiff: (projectId, params) => api.get(`/knowledge/snapshots/${projectId}/diff`, { params }),
    runConsistencyCheck: (projectId, data) => longApi.post(`/knowledge/consistency/${projectId}/check`, data),
    runQuickCheck: (projectId, data) => api.post(`/knowledge/consistency/${projectId}/quick-check`, data),
    runAiCheck: (projectId, data) => longApi.post(`/knowledge/consistency/${projectId}/ai-check`, data),
    getConsistencyReports: (projectId) => api.get(`/knowledge/consistency/${projectId}/reports`),
    getRelationshipGraph: (projectId) => api.get(`/knowledge/relationship-graph/${projectId}`),
    getPowerTracker: (projectId) => api.get(`/knowledge/power-tracker/${projectId}`)
};

export const franchiseApi = {
    list: () => api.get('/franchises'),
    get: (id) => api.get(`/franchises/${id}`),
    create: (data) => api.post('/franchises', data),
    update: (id, data) => api.put(`/franchises/${id}`, data),
    delete: (id) => api.delete(`/franchises/${id}`),
    getCharacters: (id) => api.get(`/franchises/${id}/characters`),
    createProduct: (id, data) => longApi.post(`/franchises/${id}/create-product`, data),
    getProjectOverview: (projectId) => api.get(`/franchises/project-overview/${projectId}`),
    parseFile: (formData) => api.post('/franchises/parse-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    importParsed: (data) => api.post('/franchises/import-parsed', data),
    importFileToProject: (formData) => api.post('/franchises/import-file-to-project', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
};

export const libraryApi = {
    getIndex: (params) => api.get('/library/index', { params }),
    getDepartments: () => api.get('/library/departments'),
    getTechnique: (id) => api.get(`/library/technique/${id}`),
    updateTechnique: (id, data) => api.put(`/library/technique/${id}`, data),
    search: (params) => api.get('/library/search', { params }),
    updateMeta: (id, data) => api.put(`/library/meta/${id}`, data),
    resetMeta: (id) => api.post(`/library/meta/${id}/reset`),
    getStats: () => api.get('/library/stats'),
    validatePlatform: (content, platform) => api.post('/library/validate/platform', { content, platform })
};

export const flavorsApi = {
    getDialects: () => api.get('/flavors/dialects'),
    getDialect: (region) => api.get(`/flavors/dialects/${region}`),
    previewDialect: (region, intensity, charName) => api.get(`/flavors/dialects/${region}/preview`, { params: { intensity, charName } }),
    getStyles: () => api.get('/flavors/speech-styles'),
    getStyle: (id) => api.get(`/flavors/speech-styles/${id}`),
    previewStyle: (id, intensity, charName) => api.get(`/flavors/speech-styles/${id}/preview`, { params: { intensity, charName } }),
    previewCombined: (data) => api.post('/flavors/preview-combined', data),
    getProjectPrompt: (projectId) => api.get(`/flavors/project-prompt/${projectId}`),
    getNamingStyles: () => api.get('/flavors/naming-styles'),
    inferNamingStyle: (genre) => api.get('/flavors/naming-styles/infer', { params: { genre } }),
    getNamingStyle: (id) => api.get(`/flavors/naming-styles/${id}`),
    previewNamingStyle: (id, intensity) => api.get(`/flavors/naming-styles/${id}/preview`, { params: { intensity } }),
    getMemeLexicon: () => api.get('/flavors/meme-lexicon'),
    getHumorDevices: () => api.get('/flavors/humor-devices'),
    getWorldviewTemplates: () => api.get('/flavors/worldview-templates'),
    inferWorldviewTemplate: (genre) => api.get('/flavors/worldview-templates/infer', { params: { genre } }),
    getWorldviewPhase: (id, chapter, total) => api.get(`/flavors/worldview-templates/${id}/phase`, { params: { chapter, total } }),
    getCharacterArchetypes: () => api.get('/flavors/character-archetypes'),
    getCharacterArchetype: (id) => api.get(`/flavors/character-archetypes/${id}`),
    previewCharacterArchetype: (id) => api.get(`/flavors/character-archetypes/${id}/preview`),
    getGenreProfiles: () => api.get('/flavors/genre-profiles'),
    resolveGenreProfile: (genre) => api.get('/flavors/genre-profiles/resolve', { params: { genre } }),
    getGenreProfile: (id) => api.get(`/flavors/genre-profiles/${id}`),
    getSystemPersonas: () => api.get('/flavors/system-personas'),
    getSystemPersona: (id) => api.get(`/flavors/system-personas/${id}`),
    previewSystemPersona: (id) => api.get(`/flavors/system-personas/${id}/preview`),
    reload: () => api.post('/flavors/reload')
};

export const integrityApi = {
    check: (projectId) => api.get(`/materials/integrity/${projectId}`),
    fix: (projectId, options = {}) => api.post(`/materials/integrity/${projectId}/fix`, options)
};

export const optimizerApi = {
    report: (projectId, lastNChapters = 10) => api.get(`/optimizer/report/${projectId}`, { params: { lastNChapters } }),
    suggestion: (projectId, patternId) => api.get(`/optimizer/suggestion/${projectId}/${patternId}`),
    apply: (projectId, patternId, data = {}) => api.post(`/optimizer/apply/${projectId}/${patternId}`, data)
};

export const chapterAuditApi = {
    getModels: () => api.get('/chapter-audit/models'),
    audit: (projectId) => api.get(`/chapter-audit/audit/${projectId}`),
    repair: (projectId, chapterId, data = {}) => api.post(`/chapter-audit/repair/${projectId}/${chapterId}`, data),
    repairRetry: (projectId, chapterId, data = {}) => api.post(`/chapter-audit/repair-retry/${projectId}/${chapterId}`, data),
    repairRetryStatus: (taskId) => api.get(`/chapter-audit/repair-retry/${taskId}/status`),
    repairRetryCancel: (taskId) => api.post(`/chapter-audit/repair-retry/${taskId}/cancel`),
    batchRepair: (projectId, data = {}) => api.post(`/chapter-audit/batch-repair/${projectId}`, data),
    batchRepairStatus: (taskId) => api.get(`/chapter-audit/batch-repair/${taskId}/status`),
    review: (projectId, chapterId, data = {}) => api.post(`/chapter-audit/review/${projectId}/${chapterId}`, data),
    rollback: (projectId, snapshotId) => api.post(`/chapter-audit/rollback/${projectId}/${snapshotId}`)
};

export default api;
