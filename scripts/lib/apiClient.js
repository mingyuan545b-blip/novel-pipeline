/**
 * apiClient.js — 测试脚本统一 HTTP 客户端 + 路径构建器
 *
 * 核心职责：
 * 1. 从 server/config/apiRegistry.js 读取 SSOT 路径常量，禁止硬编码
 * 2. 封装 HTTP req 函数（带 auth、超时、JSON 解析）
 * 3. 提供共享 helper：updateProjectSettings / ensureChapter / runPipeline
 *
 * 任何测试脚本 require 本模块即可获得统一的 API 调用入口，
 * 路径错误时启动自检会先于测试失败抛出。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// 从 SSOT 读取路径常量
const { TEST_PATHS, buildPath } = require(path.join(__dirname, '..', '..', 'server', 'config', 'apiRegistry'));

/** 构建完整路径（替换 :param 占位符） */
function P(templateKey, params = {}) {
    // templateKey 形如 'projects.detail' / 'pipeline.chronicle'
    const parts = templateKey.split('.');
    let template = TEST_PATHS;
    for (const p of parts) {
        if (!template || typeof template !== 'object' || !(p in template)) {
            throw new Error(`[apiClient] TEST_PATHS 中不存在路径键: ${templateKey}`);
        }
        template = template[p];
    }
    if (typeof template !== 'string') {
        throw new Error(`[apiClient] 路径键 ${templateKey} 解析后非字符串: ${typeof template}`);
    }
    return buildPath(template, params);
}

/** 从 .env 读取 AUTH_TOKEN */
function loadAuthToken() {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (!fs.existsSync(envPath)) return '';
    const m = fs.readFileSync(envPath, 'utf8').match(/^REQUEST_SECRET=(.+)$/gm);
    return (m && m.length > 0) ? m[m.length - 1].split('=')[1].trim() : '';
}

const CONFIG = Object.freeze({
    PORT: Number(process.env.TEST_PORT) || 3001,
    HOST: process.env.TEST_HOST || '127.0.0.1',
    AUTH_TOKEN: loadAuthToken(),
    TIMEOUT_MS: Number(process.env.TEST_TIMEOUT_MS) || 900000,
    POLL_MS: 5000
});

/** HTTP 请求 */
function req(method, urlPath, body, timeout = 30000) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: CONFIG.HOST, port: CONFIG.PORT,
            path: urlPath, method,
            headers: { 'Content-Type': 'application/json' },
            timeout
        };
        if (CONFIG.AUTH_TOKEN) opts.headers['Authorization'] = `Bearer ${CONFIG.AUTH_TOKEN}`;
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let c = '';
            res.on('data', d => c += d);
            res.on('end', () => {
                let parsed = c;
                try { parsed = JSON.parse(c); } catch (_) {}
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        r.on('error', e => resolve({ status: 0, body: { error: e.message } }));
        r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
        if (data) r.write(data);
        r.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (m, d) => {
    console.log(`[${new Date().toISOString().substring(11, 19)}] ${m}`);
    if (d) console.log(`  ${typeof d === 'string' ? d : JSON.stringify(d).substring(0, 400)}`);
};

/** PUT /api/projects/:id — 只更新 settings 字段，避免验证器 400 */
async function updateProjectSettings(pid, settingsPatch) {
    const getR = await req('GET', P('projects.detail', { id: pid }));
    if (getR.status !== 200) { log(`GET project failed: ${getR.status}`); return false; }
    const newSettings = { ...(getR.body.settings || {}), ...settingsPatch };
    const putR = await req('PUT', P('projects.detail', { id: pid }), { settings: newSettings });
    if (putR.status !== 200) { log(`PUT project failed: ${putR.status}`, putR.body); return false; }
    return true;
}

async function getChapterId(pid, num) {
    const r = await req('GET', `${P('chapters.list')}?projectId=${pid}`);
    if (r.status !== 200) return null;
    const arr = Array.isArray(r.body) ? r.body : [];
    const ch = arr.find(c => c.chapterNumber === num);
    return ch ? ch.id : null;
}

async function ensureChapter(pid, num, outline) {
    let cid = await getChapterId(pid, num);
    if (cid) {
        const r = await req('GET', P('chapters.detail', { id: cid }));
        if (r.status === 200 && r.body.outline && r.body.outline.length > 0) return cid;
        await req('PUT', P('chapters.detail', { id: cid }), { outline, status: 'outlined' });
        return cid;
    }
    const r = await req('POST', P('chapters.create'), {
        projectId: pid, chapterNumber: num,
        title: `第${num}章`, outline, status: 'outlined'
    });
    return r.status === 201 ? r.body.id : null;
}

/** 跑完整 pipeline，轮询直到完成/失败/超时 */
async function runPipeline(pid, num) {
    log(`\n=== 第${num}章 Pipeline 开始 ===`);
    const cid = await getChapterId(pid, num);
    if (!cid) { log('❌ 找不到章节'); return null; }
    const start = await req('POST', P('pipeline.full'),
        { projectId: pid, chapterId: cid, maxRounds: 3 }, 30000);
    if (start.status !== 200) { log(`❌ 启动失败 HTTP=${start.status}`); return null; }
    const taskId = start.body.taskId;
    log(`taskId=${taskId}`);
    const t0 = Date.now();
    let task = null;
    while (Date.now() - t0 < CONFIG.TIMEOUT_MS) {
        await sleep(CONFIG.POLL_MS);
        const tr = await req('GET', P('pipeline.task', { taskId }));
        if (tr.status !== 200) continue;
        if (tr.body.status === 'completed' || tr.body.status === 'failed') { task = tr.body; break; }
        process.stdout.write(`\r  ${Math.round((Date.now() - t0) / 1000)}s ${tr.body.status || '...'}`);
    }
    process.stdout.write('\n');
    if (!task) { log('❌ 超时'); return null; }
    if (task.status === 'failed') { log(`❌ 失败: ${task.error}`); return task; }
    log(`✅ 完成 ${Math.round((Date.now() - t0) / 1000)}s`);
    return task;
}

module.exports = {
    CONFIG, TEST_PATHS, P, req, sleep, log,
    updateProjectSettings, getChapterId, ensureChapter, runPipeline
};
