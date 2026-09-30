import { api } from './httpClient';

export const agentsApi = {
    list: () => api.get('/agents'),
    get: (type, params) => api.get(`/agents/${type}`, { params }),
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
    getWorldviewTemplate: (id) => api.get(`/flavors/worldview-templates/${id}`),
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

export const questApi = {
    listQuests: (params) => api.get('/quests/quests', { params }),
    getQuest: (id) => api.get(`/quests/quests/${id}`),
    createQuest: (data) => api.post('/quests/quests', data),
    updateQuest: (id, data) => api.put(`/quests/quests/${id}`, data),
    deleteQuest: (id) => api.delete(`/quests/quests/${id}`),
    reorderQuests: (data) => api.put('/quests/quests/reorder', data),
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
    check: () => api.get('/health'),
    getMetrics: () => api.get('/health/metrics'),
    getSnapshots: (limit) => api.get('/health/metrics/snapshots', { params: { limit } }),
    getQuotaPrediction: (hourlyTokenRate, quotaLimit) => api.get('/health/metrics/quota-prediction', { params: { hourlyTokenRate, quotaLimit } }),
    triggerSnapshot: () => api.post('/health/metrics/snapshot')
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
    validatePlatform: (content, platform) => api.post('/library/validate/platform', { content, platform }),
    getFeedback: (projectId) => api.get(`/library/technique-feedback/${projectId}`),
    deleteFeedback: (projectId) => api.delete(`/library/technique-feedback/${projectId}`),
    // 一键提取（异步长任务：提交后轮询状态）
    getExtractDimensions: () => api.get('/library/extract-dimensions'),
    extractTechniques: (payload) => api.post('/library/extract', payload),
    getExtractStatus: (taskId) => api.get(`/library/extract/${taskId}`),
    // 提取来源清单：按"从哪本书提的"聚合（回答"前面那本提取过什么"）
    getSources: () => api.get('/library/sources'),
    createTechnique: (data) => api.post('/library/techniques', data),
    deleteTechnique: (id) => api.delete(`/library/technique/${id}`),
};

const EC = '/entity-center';

export const entityRegistryApi = {
    list: (params) => api.get(`${EC}/entity-registry`, { params }),
    get: (id) => api.get(`${EC}/entity-registry/${id}`),
    create: (data) => api.post(`${EC}/entity-registry`, data),
    update: (id, data) => api.put(`${EC}/entity-registry/${id}`, data),
    delete: (id) => api.delete(`${EC}/entity-registry/${id}`)
};

export const itemDefinitionsApi = {
    list: (params) => api.get(`${EC}/item-definitions`, { params }),
    get: (id) => api.get(`${EC}/item-definitions/${id}`),
    create: (data) => api.post(`${EC}/item-definitions`, data),
    update: (id, data) => api.put(`${EC}/item-definitions/${id}`, data),
    delete: (id) => api.delete(`${EC}/item-definitions/${id}`)
};

export const characterBindsApi = {
    list: (params) => api.get(`${EC}/character-binds`, { params }),
    get: (id) => api.get(`${EC}/character-binds/${id}`),
    create: (data) => api.post(`${EC}/character-binds`, data),
    update: (id, data) => api.put(`${EC}/character-binds/${id}`, data),
    delete: (id) => api.delete(`${EC}/character-binds/${id}`)
};

export const characterRelationsApi = {
    list: (params) => api.get(`${EC}/character-relations`, { params }),
    get: (id) => api.get(`${EC}/character-relations/${id}`),
    create: (data) => api.post(`${EC}/character-relations`, data),
    update: (id, data) => api.put(`${EC}/character-relations/${id}`, data),
    delete: (id) => api.delete(`${EC}/character-relations/${id}`)
};

export const petEntitiesApi = {
    list: (params) => api.get(`${EC}/pet-entities`, { params }),
    get: (id) => api.get(`${EC}/pet-entities/${id}`),
    create: (data) => api.post(`${EC}/pet-entities`, data),
    update: (id, data) => api.put(`${EC}/pet-entities/${id}`, data),
    delete: (id) => api.delete(`${EC}/pet-entities/${id}`)
};

export const servantEntitiesApi = {
    list: (params) => api.get(`${EC}/servant-entities`, { params }),
    get: (id) => api.get(`${EC}/servant-entities/${id}`),
    create: (data) => api.post(`${EC}/servant-entities`, data),
    update: (id, data) => api.put(`${EC}/servant-entities/${id}`, data),
    delete: (id) => api.delete(`${EC}/servant-entities/${id}`)
};

const KB = '/knowledge';

export const knowledgeAccessApi = {
    list: (params) => api.get(`${KB}/knowledge-access`, { params }),
    getByFact: (projectId, factId) => api.get(`${KB}/knowledge-access`, { params: { projectId, factId } }),
    getByEntity: (projectId, entityId) => api.get(`${KB}/knowledge-access`, { params: { projectId, entityId } }),
    create: (data) => api.post(`${KB}/knowledge-access`, data),
    batchCreate: (projectId, records) => api.post(`${KB}/knowledge-access/batch`, { projectId, records }),
    delete: (id) => api.delete(`${KB}/knowledge-access/${id}`)
};
