import { api, longApi } from './httpClient';

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
    getCleanupStats: (id) => api.get(`/projects/${id}/cleanup-stats`),
    cleanup: (id, targets, keepLocked = true) => api.post(`/projects/${id}/cleanup`, { targets, keepLocked }),
    getAgentModelConfig: (id) => api.get(`/projects/${id}/agent-model-config`),
    saveAgentModelConfig: (id, config) => api.put(`/projects/${id}/agent-model-config`, config),
    saveTargets: (id, targets) => api.put(`/projects/${id}/targets`, targets),
    getGenreConstraints: (id) => api.get(`/projects/${id}/genre-constraints`),
    testConnection: (config) => api.post('/projects/test-connection', config)
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
