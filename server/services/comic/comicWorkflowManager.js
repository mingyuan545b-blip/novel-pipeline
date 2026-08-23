/**
 * comicWorkflowManager.js — 工作流CRUD
 * 创建/读取/更新/删除ComfyUI工作流
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../../shared/logger');
const fs = require('fs');
const path = require('path');
const store = require('../../store');
const { ensureComicDir, COMIC_DIR } = require('./comicConfig');

async function getWorkflows(projectId) {
    const all = await store.queryItems('comic-workflows', {});
    return all.filter(w => w.projectId === projectId || w.projectId === 'default');
}

async function getWorkflow(id) {
    return await store.getItem('comic-workflows', id);
}

async function createWorkflow(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    let nodeCount = 0;
    let jsonContent = data.jsonContent || '';

    if (jsonContent) {
        try {
            const parsed = JSON.parse(jsonContent);
            nodeCount = Object.keys(parsed || {}).length;
        } catch (_) { logger.warn('comicWorkflowManager', '[comicWorkflow] JSON parse error:', _.message || _); }
    }

    const workflow = {
        id, projectId: data.projectId || 'default', name: data.name,
        type: data.type || 'custom', description: data.description || '',
        jsonContent, nodeCount, params: data.params || {},
        createdAt: now, updatedAt: now
    };

    await store.setItem('comic-workflows', id, workflow);

    if (jsonContent) {
        const dir = ensureComicDir('workflows');
        fs.writeFileSync(path.join(dir, `${id}.json`), jsonContent, 'utf-8');
    }

    return workflow;
}

async function updateWorkflow(id, data) {
    const existing = await store.getItem('comic-workflows', id);
    if (!existing) throw new Error('Workflow not found');

    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };

    if (data.jsonContent) {
        try {
            const parsed = JSON.parse(data.jsonContent);
            updated.nodeCount = Object.keys(parsed || {}).length;
        } catch (_) { logger.warn('comicWorkflowManager', '[comicWorkflow] JSON parse error:', _.message || _); }
        const dir = ensureComicDir('workflows');
        fs.writeFileSync(path.join(dir, `${id}.json`), data.jsonContent, 'utf-8');
    }

    await store.setItem('comic-workflows', id, updated);
    return updated;
}

async function deleteWorkflow(id) {
    await store.deleteItem('comic-workflows', id);
    const filePath = path.join(COMIC_DIR, 'workflows', `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
}

module.exports = { getWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow };
