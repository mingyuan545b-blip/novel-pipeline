const { v4: uuidv4 } = require('uuid');
const logger = require('../../shared/logger');
const axios = require('axios');
const store = require('../../store');
const { getConfig } = require('./comicConfig');

async function getStoryboards(projectId) {
    return await store.queryItems('comic-storyboards', { projectId });
}

async function createStoryboard(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const storyboard = {
        id, projectId: data.projectId, chapterId: data.chapterId || '',
        sceneIndex: data.sceneIndex || 0, description: data.description || '',
        prompt: data.prompt || '', negativePrompt: data.negativePrompt || '',
        workflowId: data.workflowId || '', width: data.width || 1024, height: data.height || 1024,
        imageUrl: '', status: 'draft', renderJobId: '',
        createdAt: now, updatedAt: now
    };
    await store.setItem('comic-storyboards', id, storyboard);
    return storyboard;
}

async function updateStoryboard(id, data) {
    const existing = await store.getItem('comic-storyboards', id);
    if (!existing) throw new Error('Storyboard not found');
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await store.setItem('comic-storyboards', id, updated);
    return updated;
}

async function deleteStoryboard(id) {
    await store.deleteItem('comic-storyboards', id);
    return { success: true };
}

async function renderStoryboard(id) {
    const sb = await store.getItem('comic-storyboards', id);
    if (!sb) throw new Error('Storyboard not found');

    const config = await getConfig();
    const isLocal = config.local?.apiUrl && !config.cloud?.apiKey;
    const apiUrl = isLocal ? config.local.apiUrl : config.cloud?.apiUrl;
    const apiKey = isLocal ? null : config.cloud?.apiKey;

    if (!apiUrl) throw new Error('请先配置 ComfyUI 连接');

    const workflow = sb.workflowId ? await store.getItem('comic-workflows', sb.workflowId) : null;
    let workflowJson = workflow?.jsonContent || '{}';

    try {
        const parsed = JSON.parse(workflowJson);
        if (sb.prompt && parsed) {
            for (const node of Object.values(parsed)) {
                if (node.inputs?.prompt !== undefined) node.inputs.prompt = sb.prompt;
                if (node.inputs?.negative_prompt !== undefined) node.inputs.negative_prompt = sb.negativePrompt;
                if (node.inputs?.width !== undefined) node.inputs.width = sb.width;
                if (node.inputs?.height !== undefined) node.inputs.height = sb.height;
            }
            workflowJson = JSON.stringify(parsed);
        }
    } catch (_) { logger.warn('comicStoryboard', '[comicStoryboard] Workflow parse error:', _.message || _); }  // DEGRADE: 影响=JSON.parse 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    const queueItem = {
        id: uuidv4(), storyboardId: id,
        storyboardName: sb.description?.substring(0, 50),
        workflowName: workflow?.name || '默认',
        status: 'pending', progress: 0, elapsed: 0, promptId: '',
        createdAt: new Date().toISOString()
    };
    await store.setItem('comic-render-queue', queueItem.id, queueItem);

    sb.status = 'ready';
    sb.renderJobId = queueItem.id;
    await store.setItem('comic-storyboards', id, sb);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await axios.post(`${apiUrl}/prompt`, { prompt: workflowJson }, { headers, timeout: 30000 });

        queueItem.status = 'running';
        queueItem.promptId = res.data?.prompt_id || '';
        await store.setItem('comic-render-queue', queueItem.id, queueItem);
        sb.status = 'rendering';
        await store.setItem('comic-storyboards', id, sb);
        return { queued: true, promptId: res.data?.prompt_id, queueItemId: queueItem.id };
    } catch (e) {
        queueItem.status = 'failed';
        await store.setItem('comic-render-queue', queueItem.id, queueItem);
        sb.status = 'failed';
        await store.setItem('comic-storyboards', id, sb);
        throw new Error(`提交渲染失败: ${e.message}`);
    }
}

async function batchRender(ids) {
    const results = [];
    for (const id of ids) {
        try { results.push({ id, ...await renderStoryboard(id) }); }
        catch (e) { results.push({ id, error: e.message }); }
    }
    return results;
}

async function getRenderQueue(projectId) {
    const all = await store.queryItems('comic-render-queue', {});
    if (projectId) {
        const sbs = await store.queryItems('comic-storyboards', { projectId });
        const sbIds = new Set(sbs.map(s => s.id));
        return all.filter(q => sbIds.has(q.storyboardId));
    }
    return all;
}

async function cancelRender(id) {
    const item = await store.getItem('comic-render-queue', id);
    if (!item) throw new Error('Render job not found');
    item.status = 'cancelled';
    await store.setItem('comic-render-queue', id, item);
    const sb = await store.getItem('comic-storyboards', item.storyboardId);
    if (sb) { sb.status = 'draft'; await store.setItem('comic-storyboards', item.storyboardId, sb); }
    return { success: true };
}

async function retryRender(id) {
    const item = await store.getItem('comic-render-queue', id);
    if (!item) throw new Error('Render job not found');
    return renderStoryboard(item.storyboardId);
}

async function clearCompleted(projectId) {
    const queue = await getRenderQueue(projectId);
    for (const item of queue) {
        if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
            await store.deleteItem('comic-render-queue', item.id);
        }
    }
    return { success: true };
}

const { startLocalComfyUI, stopLocalComfyUI, getComfyUIStatus } = require('./comfyUIProcess');

module.exports = {
    getStoryboards, createStoryboard, updateStoryboard, deleteStoryboard,
    renderStoryboard, batchRender, getRenderQueue, cancelRender, retryRender, clearCompleted,
    startLocalComfyUI, stopLocalComfyUI, getComfyUIStatus
};
