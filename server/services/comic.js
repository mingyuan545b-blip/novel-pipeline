const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const axios = require('axios');
const { spawn } = require('child_process');

const COMIC_DIR = path.join(__dirname, '..', '..', 'output', 'comic');

function ensureComicDir(subDir) {
    const dir = path.join(COMIC_DIR, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function getConfig() {
    const config = store.getItem('comic-config', 'global');
    return config || {
        local: {
            apiUrl: 'http://127.0.0.1:8188',
            wsUrl: 'ws://127.0.0.1:8188',
            outputDir: '',
            autoStart: false,
            gpuDevice: '0',
            vae: '',
            checkpoint: '',
            timeout: 300
        },
        cloud: {
            provider: 'comfyui-cloud',
            apiUrl: '',
            apiKey: '',
            apiSecret: '',
            region: 'cn-east-1',
            instanceType: 'gpu-a10',
            autoScale: true,
            minInstances: 0,
            maxInstances: 2,
            idleTimeout: 300
        }
    };
}

async function saveConfig(config) {
    store.setItem('comic-config', 'global', config);
    ensureComicDir('workflows');
    return config;
}

async function testConnection(params) {
    const { type, ...config } = params;
    if (type === 'local') {
        try {
            const res = await axios.get(`${config.apiUrl}/system_stats`, { timeout: 10000 });
            const sys = res.data?.system || {};
            const devices = res.data?.devices || [];
            const deviceInfo = devices.map((d, i) =>
                `GPU${i}: ${d.name} | VRAM: ${Math.round((d.vram_total || 0) / 1073741824)}GB (空闲: ${Math.round((d.vram_free || 0) / 1073741824)}GB)`
            ).join('\n');
            return {
                success: true,
                message: `本地 ComfyUI 连接成功`,
                systemInfo: {
                    comfyuiVersion: sys.comfyui_version || '未知',
                    pythonVersion: sys.python_version || '未知',
                    pytorchVersion: sys.pytorch_version || '未知',
                    os: sys.os || '未知',
                    ramTotal: Math.round((sys.ram_total || 0) / 1073741824),
                    ramFree: Math.round((sys.ram_free || 0) / 1073741824),
                    devices: devices.map((d, i) => ({
                        index: i,
                        name: d.name,
                        type: d.type,
                        vramTotal: Math.round((d.vram_total || 0) / 1073741824),
                        vramFree: Math.round((d.vram_free || 0) / 1073741824)
                    })),
                    deviceSummary: deviceInfo
                }
            };
        } catch (e) {
            return {
                success: false,
                message: `连接失败: ${e.message}. 请确保 ComfyUI 已启动并监听 ${config.apiUrl}`
            };
        }
    } else {
        if (!config.apiUrl || !config.apiKey) {
            return { success: false, message: '请填写云端 API 地址和 API Key' };
        }
        try {
            const res = await axios.get(`${config.apiUrl}/status`, {
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
                timeout: 15000
            });
            return { success: true, message: '云端 ComfyUI 连接成功' };
        } catch (e) {
            return {
                success: false,
                message: `云端连接失败: ${e.message}`
            };
        }
    }
}

async function getWorkflows(projectId) {
    const all = store.queryItems('comic-workflows', {});
    return all.filter(w => w.projectId === projectId || w.projectId === 'default');
}

async function getWorkflow(id) {
    return store.getItem('comic-workflows', id);
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
        } catch {}
    }

    const workflow = {
        id,
        projectId: data.projectId || 'default',
        name: data.name,
        type: data.type || 'custom',
        description: data.description || '',
        jsonContent,
        nodeCount,
        params: data.params || {},
        createdAt: now,
        updatedAt: now
    };

    store.setItem('comic-workflows', id, workflow);

    if (jsonContent) {
        const dir = ensureComicDir('workflows');
        fs.writeFileSync(path.join(dir, `${id}.json`), jsonContent, 'utf-8');
    }

    return workflow;
}

async function updateWorkflow(id, data) {
    const existing = store.getItem('comic-workflows', id);
    if (!existing) throw new Error('Workflow not found');

    const updated = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString()
    };

    if (data.jsonContent) {
        try {
            const parsed = JSON.parse(data.jsonContent);
            updated.nodeCount = Object.keys(parsed || {}).length;
        } catch {}
        const dir = ensureComicDir('workflows');
        fs.writeFileSync(path.join(dir, `${id}.json`), data.jsonContent, 'utf-8');
    }

    store.setItem('comic-workflows', id, updated);
    return updated;
}

async function deleteWorkflow(id) {
    store.deleteItem('comic-workflows', id);
    const filePath = path.join(COMIC_DIR, 'workflows', `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
}

async function getStoryboards(projectId) {
    return store.queryItems('comic-storyboards', { projectId });
}

async function createStoryboard(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const storyboard = {
        id,
        projectId: data.projectId,
        chapterId: data.chapterId || '',
        sceneIndex: data.sceneIndex || 0,
        description: data.description || '',
        prompt: data.prompt || '',
        negativePrompt: data.negativePrompt || '',
        workflowId: data.workflowId || '',
        width: data.width || 1024,
        height: data.height || 1024,
        imageUrl: '',
        status: 'draft',
        renderJobId: '',
        createdAt: now,
        updatedAt: now
    };
    store.setItem('comic-storyboards', id, storyboard);
    return storyboard;
}

async function updateStoryboard(id, data) {
    const existing = store.getItem('comic-storyboards', id);
    if (!existing) throw new Error('Storyboard not found');
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    store.setItem('comic-storyboards', id, updated);
    return updated;
}

async function deleteStoryboard(id) {
    store.deleteItem('comic-storyboards', id);
    return { success: true };
}

async function renderStoryboard(id) {
    const sb = store.getItem('comic-storyboards', id);
    if (!sb) throw new Error('Storyboard not found');

    const config = await getConfig();
    const isLocal = config.local?.apiUrl && !config.cloud?.apiKey;
    const apiUrl = isLocal ? config.local.apiUrl : config.cloud?.apiUrl;
    const apiKey = isLocal ? null : config.cloud?.apiKey;

    if (!apiUrl) throw new Error('请先配置 ComfyUI 连接');

    const workflow = sb.workflowId ? store.getItem('comic-workflows', sb.workflowId) : null;
    let workflowJson = workflow?.jsonContent || '{}';

    try {
        const parsed = JSON.parse(workflowJson);
        if (sb.prompt && parsed) {
            for (const node of Object.values(parsed)) {
                if (node.inputs?.prompt !== undefined) {
                    node.inputs.prompt = sb.prompt;
                }
                if (node.inputs?.negative_prompt !== undefined) {
                    node.inputs.negative_prompt = sb.negativePrompt;
                }
                if (node.inputs?.width !== undefined) {
                    node.inputs.width = sb.width;
                }
                if (node.inputs?.height !== undefined) {
                    node.inputs.height = sb.height;
                }
            }
            workflowJson = JSON.stringify(parsed);
        }
    } catch {}

    const queueItem = {
        id: uuidv4(),
        storyboardId: id,
        storyboardName: sb.description?.substring(0, 50),
        workflowName: workflow?.name || '默认',
        status: 'pending',
        progress: 0,
        elapsed: 0,
        promptId: '',
        createdAt: new Date().toISOString()
    };
    store.setItem('comic-render-queue', queueItem.id, queueItem);

    sb.status = 'ready';
    sb.renderJobId = queueItem.id;
    store.setItem('comic-storyboards', id, sb);

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await axios.post(`${apiUrl}/prompt`, {
            prompt: workflowJson
        }, { headers, timeout: 30000 });

        queueItem.status = 'running';
        queueItem.promptId = res.data?.prompt_id || '';
        store.setItem('comic-render-queue', queueItem.id, queueItem);

        sb.status = 'rendering';
        store.setItem('comic-storyboards', id, sb);

        return { queued: true, promptId: res.data?.prompt_id, queueItemId: queueItem.id };
    } catch (e) {
        queueItem.status = 'failed';
        store.setItem('comic-render-queue', queueItem.id, queueItem);
        sb.status = 'failed';
        store.setItem('comic-storyboards', id, sb);
        throw new Error(`提交渲染失败: ${e.message}`);
    }
}

async function batchRender(ids) {
    const results = [];
    for (const id of ids) {
        try {
            const result = await renderStoryboard(id);
            results.push({ id, ...result });
        } catch (e) {
            results.push({ id, error: e.message });
        }
    }
    return results;
}

async function getRenderQueue(projectId) {
    const all = store.queryItems('comic-render-queue', {});
    if (projectId) {
        const sbs = store.queryItems('comic-storyboards', { projectId });
        const sbIds = new Set(sbs.map(s => s.id));
        return all.filter(q => sbIds.has(q.storyboardId));
    }
    return all;
}

async function cancelRender(id) {
    const item = store.getItem('comic-render-queue', id);
    if (!item) throw new Error('Render job not found');
    item.status = 'cancelled';
    store.setItem('comic-render-queue', id, item);

    const sb = store.getItem('comic-storyboards', item.storyboardId);
    if (sb) {
        sb.status = 'draft';
        store.setItem('comic-storyboards', item.storyboardId, sb);
    }
    return { success: true };
}

async function retryRender(id) {
    const item = store.getItem('comic-render-queue', id);
    if (!item) throw new Error('Render job not found');
    return renderStoryboard(item.storyboardId);
}

async function clearCompleted(projectId) {
    const queue = await getRenderQueue(projectId);
    for (const item of queue) {
        if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
            store.deleteItem('comic-render-queue', item.id);
        }
    }
    return { success: true };
}

let comfyuiProcess = null;

async function startLocalComfyUI() {
    const config = await getConfig();
    const installDir = config.local?.installDir || config.installDir;
    const startCommand = config.local?.startCommand || config.startCommand;
    const apiUrl = config.local?.apiUrl || config.apiUrl || 'http://127.0.0.1:8188';

    if (!installDir || !startCommand) {
        return { success: false, message: '请先配置 ComfyUI 安装目录和启动命令' };
    }

    try {
        const healthCheck = await axios.get(`${apiUrl}/system_stats`, { timeout: 3000 }).catch(() => null);
        if (healthCheck) {
            return { success: true, message: 'ComfyUI 已在运行中' };
        }
    } catch {}

    if (comfyuiProcess) {
        return { success: false, message: 'ComfyUI 进程已在运行中' };
    }

    try {
        const isWindows = process.platform === 'win32';
        const pythonExe = path.join(installDir, '.venv', 'Scripts', 'python.exe');
        const mainPy = path.join(installDir, 'ComfyUI', 'main.py');
        const outputDir = path.join(__dirname, '..', '..', 'output', 'comfyui');
        const inputDir = path.join(__dirname, '..', '..', 'output', 'comfyui_input');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });

        comfyuiProcess = spawn(pythonExe, [mainPy, '--listen', '127.0.0.1', '--port', '8188', '--output-directory', outputDir, '--input-directory', inputDir], {
            cwd: installDir,
            stdio: 'pipe',
            detached: false,
            env: {
                ...process.env,
                HSA_OVERRIDE_GFX_VERSION: '11.0.0',
                PYTORCH_HIP_ALLOC_CONF: 'garbage_collection_threshold:0.6,max_split_size_mb:128',
                HIP_VISIBLE_DEVICES: '0',
                PYTHONUNBUFFERED: '1',
                VIRTUAL_ENV: path.join(installDir, '.venv'),
                PATH: path.join(installDir, '.venv', 'Scripts') + ';' + process.env.PATH
            }
        });

        comfyuiProcess.stdout.on('data', (data) => {
            console.log(`[ComfyUI] ${data.toString().trim()}`);
        });

        comfyuiProcess.stderr.on('data', (data) => {
            console.error(`[ComfyUI] ${data.toString().trim()}`);
        });

        comfyuiProcess.on('close', (code) => {
            console.log(`[ComfyUI] Process exited with code ${code}`);
            comfyuiProcess = null;
        });

        comfyuiProcess.on('error', (err) => {
            console.error(`[ComfyUI] Process error: ${err.message}`);
            comfyuiProcess = null;
        });

        return { success: true, message: `ComfyUI 启动命令已发送，目录: ${installDir}` };
    } catch (e) {
        return { success: false, message: `启动失败: ${e.message}` };
    }
}

async function stopLocalComfyUI() {
    if (!comfyuiProcess) {
        return { success: false, message: '没有正在运行的 ComfyUI 进程' };
    }
    try {
        comfyuiProcess.kill();
        comfyuiProcess = null;
        return { success: true, message: 'ComfyUI 进程已终止' };
    } catch (e) {
        return { success: false, message: `终止失败: ${e.message}` };
    }
}

function getComfyUIStatus() {
    return { running: !!comfyuiProcess };
}

module.exports = {
    getConfig,
    saveConfig,
    testConnection,
    getWorkflows,
    getWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    getStoryboards,
    createStoryboard,
    updateStoryboard,
    deleteStoryboard,
    renderStoryboard,
    batchRender,
    getRenderQueue,
    cancelRender,
    retryRender,
    clearCompleted,
    startLocalComfyUI,
    stopLocalComfyUI,
    getComfyUIStatus
};
