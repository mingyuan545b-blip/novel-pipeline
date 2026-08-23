import { api, longApi } from './httpClient';

export const materialsApi = {
    list: (params) => api.get('/materials', { params }),
    get: (id) => api.get(`/materials/${id}`),
    create: (data) => api.post('/materials', data),
    update: (id, data) => api.put(`/materials/${id}`, data),
    delete: (id) => api.delete(`/materials/${id}`),
    getTypes: () => api.get('/materials/types')
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

export const reviewsApi = {
    list: (params) => api.get('/reviews', { params }),
    get: (id) => api.get(`/reviews/${id}`),
    create: (data) => api.post('/reviews', data),
    update: (id, data) => api.put(`/reviews/${id}`, data),
    delete: (id) => api.delete(`/reviews/${id}`)
};

export const integrityApi = {
    check: (projectId) => api.get(`/materials/integrity/${projectId}`),
    fix: (projectId, options = {}) => api.post(`/materials/integrity/${projectId}/fix`, options)
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
    getPowerTracker: (projectId) => api.get(`/knowledge/power-tracker/${projectId}`),
    getTimelineEvents: (projectId, params) => api.get(`/knowledge/timeline/${projectId}/events`, { params }),
    createTimelineEvent: (projectId, data) => api.post(`/knowledge/timeline/${projectId}/events`, data),
    updateTimelineEvent: (projectId, eventId, data) => api.put(`/knowledge/timeline/${projectId}/events/${eventId}`, data),
    deleteTimelineEvent: (projectId, eventId) => api.delete(`/knowledge/timeline/${projectId}/events/${eventId}`),
    getTimelineCausalChain: (projectId, eventId) => api.get(`/knowledge/timeline/${projectId}/causal-chain/${eventId}`),
    getTimelineConflicts: (projectId, chapterNumber) => api.get(`/knowledge/timeline/${projectId}/conflicts`, { params: { chapterNumber } }),
    getTimelineStats: (projectId) => api.get(`/knowledge/timeline/${projectId}/stats`),
    checkPowerConsistency: (projectId, chapterNumber) => api.get(`/knowledge/power-guard/${projectId}/check`, { params: { chapterNumber } }),
    getPowerCurve: (projectId, entityId, fromChapter, toChapter) => api.get(`/knowledge/power-guard/${projectId}/curve/${entityId}`, { params: { fromChapter, toChapter } }),
    getForeshadowOverdue: (projectId, currentChapter) => api.get(`/knowledge/foreshadow-guard/${projectId}/overdue`, { params: { currentChapter } }),
    getForeshadowStats: (projectId) => api.get(`/knowledge/foreshadow-guard/${projectId}/stats`),
    checkCharacterArcs: (projectId, chapterNumber) => api.get(`/knowledge/character-arc-guard/${projectId}/check`, { params: { chapterNumber } }),
    getCharacterActivity: (projectId, chapterNumber) => api.get(`/knowledge/character-arc-guard/${projectId}/activity`, { params: { chapterNumber } }),
    runConsistencyAudit: (projectId, chapterNumber) => api.post(`/knowledge/consistency-audit/${projectId}/run`, { chapterNumber }),
    getAuditHistory: (projectId, limit) => api.get(`/knowledge/consistency-audit/${projectId}/history`, { params: { limit } }),
    getMaterialAnalysis: (projectId, currentChapter) => api.get(`/knowledge/material-lifecycle/${projectId}/analysis`, { params: { currentChapter } }),
    archiveStaleMaterials: (projectId, currentChapter) => api.post(`/knowledge/material-lifecycle/${projectId}/archive`, { currentChapter }),
    getMaterialDuplicates: (projectId) => api.get(`/knowledge/material-lifecycle/${projectId}/duplicates`),
    getMaterialBudget: (projectId, chapterNumber) => api.get(`/knowledge/material-lifecycle/${projectId}/budget`, { params: { chapterNumber } }),
    getMaterialHealth: (projectId, currentChapter) => api.get(`/knowledge/material-lifecycle/${projectId}/health`, { params: { currentChapter } })
};
