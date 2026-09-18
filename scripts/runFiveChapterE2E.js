/**
 * runFiveChapterE2E.js — 新项目 5 章端到端验证
 * 用法: node scripts/runFiveChapterE2E.js
 * 流程: 创建项目 → 生成素材 → 生成大纲(5章) → 逐章跑完整流水线 → 输出项目ID
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const CHAPTERS = Number(process.argv[2]) || 5;
const RESUME_ID = process.argv[3] || null;  // 传入已创建的项目ID可断点续跑

function fetchApi(method, path, body, timeoutMs = 1800000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { Authorization: 'Bearer ' + REQUEST_SECRET, 'Content-Type': 'application/json' },
            timeout: timeoutMs,
        };
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, data: d }); }
            });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error('超时 ' + method + ' ' + path)); });
        if (data) r.write(data);
        r.end();
    });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROJECT_DESC = require('./fiveChapterProjectDesc');

async function createProject() {
    console.log('=== 步骤1: 创建项目 ===');
    const body = {
        name: '丧仪司_五章验证_' + Date.now(),
        description: PROJECT_DESC,
        genre: '高武',
        subGenre: 'high-martial-comedy',
        targetChapters: 120,
        settings: { chapterRounds: 3, chronicleLevel: 'full', worldScopeLevel: 'full' },
    };
    const r = await fetchApi('POST', '/api/projects', body);
    const pid = r.data && r.data.id;
    console.log('HTTP=' + r.status + ' 项目ID=' + (pid || '无'));
    if (!pid) throw new Error('项目创建失败: ' + JSON.stringify(r.data).substring(0, 300));
    return pid;
}

async function generateMaterials(pid) {
    console.log('\n=== 步骤2: 生成素材 ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-materials', { projectId: pid, prompt: PROJECT_DESC });
    console.log('HTTP=' + r.status + ' 耗时=' + ((Date.now() - t) / 1000).toFixed(1) + 's');
    const mats = (r.data && r.data.materials) || [];
    console.log('素材数: ' + mats.length);
    for (const m of mats) console.log('  - ' + m.type + ': ' + m.name + ' (' + (m.content || '').length + '字)');
    return mats;
}

async function generateOutlines(pid) {
    console.log('\n=== 步骤3: 生成大纲(' + CHAPTERS + '章) ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-outlines', { projectId: pid, prompt: PROJECT_DESC, targetChapters: CHAPTERS });
    console.log('HTTP=' + r.status + ' 耗时=' + ((Date.now() - t) / 1000).toFixed(1) + 's');
    const chs = (r.data && r.data.chapters) || [];
    console.log('大纲数: ' + chs.length);
    for (const c of chs) console.log('  - 第' + c.chapterNumber + '章: ' + c.title);
    return chs;
}

async function runChapterPipeline(pid, chapter) {
    const t = Date.now();
    console.log('\n--- 第' + chapter.chapterNumber + '章流水线 ---');
    const r = await fetchApi('POST', '/api/pipeline/full', { projectId: pid, chapterId: chapter.id, maxRounds: 3 });
    if (!r.data || !r.data.taskId) {
        console.log('提交失败: ' + JSON.stringify(r.data).substring(0, 300));
        return { ok: false };
    }
    for (let i = 0; i < 300; i++) {
        await sleep(10000);
        const s = await fetchApi('GET', '/api/pipeline/task/' + r.data.taskId);
        const st = s.data && s.data.status;
        if (st === 'completed' || st === 'done') {
            console.log('完成 耗时=' + ((Date.now() - t) / 1000).toFixed(1) + 's');
            return { ok: true };
        }
        if (st === 'failed' || st === 'error') {
            console.log('失败: ' + JSON.stringify(s.data).substring(0, 400));
            return { ok: false };
        }
        process.stdout.write('\r  等待 ' + (i * 10 + 10) + 's [' + (st || '...') + ']   ');
    }
    console.log('\n超时');
    return { ok: false };
}

(async () => {
    let pid;
    try {
        pid = RESUME_ID || await createProject();
        if (RESUME_ID) console.log('续跑已有项目: ' + RESUME_ID);
        await generateMaterials(pid);
        await generateOutlines(pid);
        const chResp = await fetchApi('GET', '/api/chapters?projectId=' + pid);
        const chapters = Array.isArray(chResp.data) ? chResp.data : ((chResp.data && chResp.data.chapters) || []);
        const sorted = chapters.slice().sort((a, b) => a.chapterNumber - b.chapterNumber).slice(0, CHAPTERS);
        console.log('\n=== 步骤4: 逐章执行流水线（共' + sorted.length + '章） ===');
        const outcome = [];
        for (const ch of sorted) {
            const res = await runChapterPipeline(pid, ch);
            outcome.push({ chapter: ch.chapterNumber, ok: res.ok });
        }
        const okCount = outcome.filter((o) => o.ok).length;
        console.log('\n=== 完成: ' + okCount + '/' + outcome.length + ' 章通过 ===');
        console.log('PROJECT_ID=' + pid);
        console.log('下一步: node scripts/verifyDataFlow.js ' + pid + ' 5');
        console.log('        node scripts/verifyFiveChapterE2E.js ' + pid);
        process.exit(okCount === outcome.length ? 0 : 2);
    } catch (e) {
        console.error('E2E 失败:', e.message);
        if (pid) console.error('已创建项目ID=' + pid);
        process.exit(1);
    }
})();
