import { api } from './httpClient';

export const chaptersApi = {
    list: (params) => api.get('/chapters', { params }),
    get: (id) => api.get(`/chapters/${id}`),
    create: (data) => api.post('/chapters', data),
    update: (id, data) => api.put(`/chapters/${id}`, data),
    delete: (id) => api.delete(`/chapters/${id}`),
    reset: (id) => api.post(`/chapters/${id}/reset`),
    downloadNovel: (projectId) => api.get(`/chapters/download-novel/${projectId}`, { responseType: 'blob' })
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

export const characterStateApi = {
    getStates: (projectId, chapter) => api.get(`/character-states/states/${projectId}`, { params: chapter ? { chapter } : {} }),
    getCharacters: (projectId, chapter) => api.get(`/character-states/characters/${projectId}`, { params: chapter ? { chapter } : {} }),
    getKV: (projectId, filters = {}) => api.get(`/character-states/kv/${projectId}`, { params: filters }),
    getSummary: (projectId, chapter, characterId) => api.get(`/character-states/summary/${projectId}`, { params: { ...(chapter ? { chapter } : {}), ...(characterId ? { characterId } : {}) } }),
    getHistory: (projectId, characterId, limit) => api.get(`/character-states/history/${projectId}/${characterId}`, { params: limit ? { limit } : {} }),
    getMeta: (projectId) => api.get(`/character-states/meta/${projectId}`),
    sync: (projectId, fromChapter, toChapter) => api.post(`/character-states/sync/${projectId}`, { fromChapter, toChapter }),
    migrateChineseKeys: (projectId) => api.post(`/character-states/migrate-chinese-keys/${projectId}`)
};
