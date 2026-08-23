import { api, longApi } from './httpClient';

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

export const guideApi = {
    getAll: () => api.get('/guide'),
    getQuickStart: () => api.get('/guide/quick-start'),
    getAipyPro: () => api.get('/guide/aipy-pro'),
    getPipelineFlow: () => api.get('/guide/pipeline-flow'),
    getAgentRoles: () => api.get('/guide/agent-roles')
};

export const settingsApi = {
    get: () => api.get('/settings'),
    save: (data) => api.post('/settings', data),
    test: () => longApi.post('/settings/test')
};
