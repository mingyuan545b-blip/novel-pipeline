/**
 * run20ChapterE2E.js — 新项目 20 章端到端验证（含功能探针）
 *
 * 用法:
 *   node scripts/run20ChapterE2E.js                 # 全流程
 *   node scripts/run20ChapterE2E.js --resume <pid>  # 断点续跑
 *
 * 目标：跑通全链路的同时，把每一处异常（HTTP 非 200、字段缺失、轮次缺档、
 *       实体标签漂移、素材未更新、字数不达标…）如实记录下来，不掩盖。
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const fs = require('fs');
const path = require('path');
const { STATUS_VALUES } = require('../server/services/chapterStatus');

const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const CHAPTERS = 20;
const MAX_ROUNDS = 3;
const OUT_DIR = path.resolve(__dirname, '..', 'output', 'e2e-20ch');
fs.mkdirSync(OUT_DIR, { recursive: true });

const argv = process.argv.slice(2);
const RESUME_ID = argv.includes('--resume') ? argv[argv.indexOf('--resume') + 1] : null;
const FORCE = argv.includes('--force');
// --only 3 或 --only 3,4,15：只跑指定章节（用于定向复验）
const ONLY = argv.includes('--only')
    ? String(argv[argv.indexOf('--only') + 1] || '').split(',').map(s => Number(s.trim())).filter(n => n > 0)
    : null;

const anomalies = [];
const summary = { chapters: [], startedAt: new Date().toISOString() };

function log(...a) {
    const line = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    console.log(line);
    fs.appendFileSync(path.join(OUT_DIR, 'run.log'), line + '\n');
}
function anomaly(kind, detail) {
    const rec = { kind, detail, at: new Date().toISOString() };
    anomalies.push(rec);
    log('  [ANOMALY:' + kind + '] ' + JSON.stringify(detail).substring(0, 400));
}
function saveReport() {
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ summary, anomalies }, null, 2));
}

function fetchApi(method, p, body, timeoutMs = 2400000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3001, path: p, method,
            headers: { Authorization: 'Bearer ' + REQUEST_SECRET, 'Content-Type': 'application/json' },
            timeout: timeoutMs
        };
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => {
                let parsed; try { parsed = JSON.parse(d); } catch { parsed = d; }
                resolve({ status: res.statusCode, data: parsed });
            });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error('timeout ' + method + ' ' + p)); });
        if (data) r.write(data);
        r.end();
    });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step1_createProject(desc) {
    log('');
    log('=== 步骤1: 创建项目 ===');
    const body = {
        name: '逆江湖_苍生为局_20章_' + Date.now(),
        description: desc,
        genre: '高武',
        subGenre: 'high-martial-comedy',
        targetChapters: CHAPTERS,
        settings: { chapterRounds: MAX_ROUNDS, chronicleLevel: 'full', worldScopeLevel: 'full' }
    };
    const r = await fetchApi('POST', '/api/projects', body);
    if (r.status !== 200 && r.status !== 201) anomaly('createProject.http', { status: r.status, body: String(JSON.stringify(r.data)).substring(0, 300) });
    // 注意：POST /api/projects 返回 {success, data:{...}} 信封，GET 返回裸对象 —— 契约不一致，这里两种都兼容
    const pid = r.data && (r.data.id || (r.data.data && r.data.data.id));
    if (!pid) { anomaly('createProject.noId', r.data); throw new Error('项目创建失败'); }
    log('项目ID = ' + pid);
    const chk = await fetchApi('GET', '/api/projects/' + pid);
    const p = chk.data && (chk.data.project || chk.data);
    if (!p || !p.styleProfile || !p.styleProfile.key) anomaly('createProject.styleProfileMissing', p && p.styleProfile);
    if (!p || !p.wordConfig) anomaly('createProject.wordConfigMissing', null);
    log('styleProfile.key=' + (p && p.styleProfile && p.styleProfile.key) + ' subGenre=' + (p && p.subGenre));
    log('wordConfig=' + JSON.stringify(p && p.wordConfig));
    return pid;
}

async function step2_materials(pid, desc) {
    log('');
    log('=== 步骤2: 生成素材 ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-materials', { projectId: pid, prompt: desc });
    log('HTTP=' + r.status + ' 耗时=' + ((Date.now() - t) / 1000).toFixed(1) + 's');
    if (r.status !== 200) anomaly('materials.http', { status: r.status, body: String(JSON.stringify(r.data)).substring(0, 300) });
    // 后端实际返回 {created, count, syncedFacts, depthStats}，没有 materials 字段
    const mats = (r.data && (r.data.created || r.data.materials)) || [];
    if (r.data && r.data.error) anomaly('materials.backendError', { error: r.data.error, raw: String(r.data.raw || '').substring(0, 200) });
    log('素材数: ' + mats.length + ' (count=' + (r.data && r.data.count) + ')');
    if (r.data && r.data.depthStats) log('深度补全: ' + JSON.stringify(r.data.depthStats).substring(0, 200));
    mats.forEach(m => log('  - ' + m.type + ': ' + m.name + ' (' + ((m.content || m.initialContent || '').length) + '字)'));
    const chars = mats.filter(m => m.type === 'character');
    if (chars.length === 0) anomaly('materials.noCharacter', { total: mats.length });
    const protags = chars.filter(m => m.isMainCharacter || m.roleLevel === 'protagonist');
    if (protags.length === 0) anomaly('materials.noProtagonist', chars.map(c => ({ n: c.name, r: c.roleLevel, imc: c.isMainCharacter })));
    else if (protags.length > 1) anomaly('materials.multiProtagonist', protags.map(p => p.name));
    return mats;
}

async function step3_outlines(pid, desc) {
    log('');
    log('=== 步骤3: 生成大纲(' + CHAPTERS + '章) ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-outlines', { projectId: pid, prompt: desc, targetChapters: CHAPTERS });
    log('HTTP=' + r.status + ' 耗时=' + ((Date.now() - t) / 1000).toFixed(1) + 's');
    if (r.status !== 200) anomaly('outlines.http', { status: r.status, body: String(JSON.stringify(r.data)).substring(0, 300) });
    // 后端实际返回 {outlines, created, count, driftIssues}
    const chs = (r.data && (r.data.outlines || r.data.created || r.data.chapters)) || [];
    if (r.data && r.data.error) anomaly('outlines.backendError', { error: r.data.error, raw: String(r.data.raw || '').substring(0, 200) });
    if (r.data && r.data.driftIssues && r.data.driftIssues.length) anomaly('outlines.driftIssues', r.data.driftIssues.slice(0, 5));
    log('大纲数: ' + chs.length + ' (count=' + (r.data && r.data.count) + ')');
    if (chs.length < CHAPTERS) anomaly('outlines.shortfall', { got: chs.length, want: CHAPTERS });
    chs.forEach(c => log('  - 第' + c.chapterNumber + '章: ' + c.title));
    return chs;
}

async function probeEntityCenter(pid, chapterNumber) {
    const r = await fetchApi('GET', '/api/entity-center/entity-registry?projectId=' + pid);
    if (r.status !== 200) { anomaly('entityCenter.http', { status: r.status, ch: chapterNumber }); return; }
    const list = Array.isArray(r.data) ? r.data : [];
    const chars = list.filter(e => e.entityType === 'character');
    const protags = chars.filter(e => e.roleLevel === 'protagonist');
    if (protags.length > 1) anomaly('entityCenter.multiProtagonist', { ch: chapterNumber, count: protags.length, names: protags.map(p => p.name) });
    log('  实体中心角色 ' + chars.length + ' 个 -> ' + chars.map(c => c.name + ':' + c.roleLevel).join(', '));
    const BAD = /[】【\[\]]/;
    chars.forEach(c => {
        const bad = ['signatureDetail', 'position', 'personality', 'speakingTone'].filter(f => typeof c[f] === 'string' && BAD.test(c[f]));
        if (bad.length) anomaly('entityCenter.labelResidue', { ch: chapterNumber, name: c.name, sample: bad.map(f => f + '=' + c[f]).join(' | ') });
    });
    summary.entityRoles = chars.map(c => ({ name: c.name, roleLevel: c.roleLevel, appearCount: c.appearCount }));
}

async function probeReviews(pid, chapterId, chapterNumber) {
    const r = await fetchApi('GET', '/api/reviews?chapterId=' + chapterId);
    if (r.status !== 200) { anomaly('reviews.http', { status: r.status, ch: chapterNumber }); return; }
    const list = Array.isArray(r.data) ? r.data : [];
    if (list.length === 0) { anomaly('reviews.empty', { ch: chapterNumber }); return; }
    const withRunRound = list.filter(x => typeof x.runRound === 'number');
    log('  审查记录 ' + list.length + ' 条: ' + list.map(x => (x.runRound ? '第' + x.runRound + '轮(累计' + x.round + ')' : '累计R' + x.round)).join(', '));
    if (withRunRound.length === 0) anomaly('reviews.noRunRound', { ch: chapterNumber, rounds: list.map(x => x.round) });
    const types = Array.from(new Set(list.map(x => x.type)));
    log('  审查类型: ' + types.join(', '));
    if (types.indexOf('unknown-step') >= 0 || types.indexOf(undefined) >= 0) anomaly('reviews.badType', { ch: chapterNumber, types: types });
    summary['reviews_ch' + chapterNumber] = { total: list.length, withRunRound: withRunRound.length, types: types };
}

async function probeChapter(pid, chapter) {
    const r = await fetchApi('GET', '/api/chapters/' + chapter.id);
    const ch = (r.data && (r.data.chapter || r.data));
    if (!ch) { anomaly('chapter.fetch', { ch: chapter.chapterNumber }); return null; }
    const wc = ch.wordCount || (ch.content || '').replace(/\s/g, '').length;
    log('  第' + chapter.chapterNumber + '章 状态=' + ch.status + ' 字数=' + wc + ' 累计轮次=' + ch.round);
    if (wc < 2000) anomaly('chapter.wordCountLow', { ch: chapter.chapterNumber, wc: wc, status: ch.status });
    if (ch.status !== STATUS_VALUES.MATERIAL_UPDATED) anomaly('chapter.statusNotFinal', { ch: chapter.chapterNumber, status: ch.status });
    return ch;
}

async function runChapter(pid, chapter) {
    const t0 = Date.now();
    log('');
    log('--- 第' + chapter.chapterNumber + '章: ' + chapter.title + ' ---');
    const r = await fetchApi('POST', '/api/pipeline/full', { projectId: pid, chapterId: chapter.id, maxRounds: MAX_ROUNDS });
    if (!r.data || !r.data.taskId) {
        anomaly('pipeline.noTaskId', { ch: chapter.chapterNumber, status: r.status, body: String(JSON.stringify(r.data)).substring(0, 300) });
        return { ch: chapter.chapterNumber, ok: false };
    }
    const taskId = r.data.taskId;
    for (let i = 0; i < 400; i++) {
        await sleep(10000);
        const s = await fetchApi('GET', '/api/pipeline/task/' + taskId);
        const st = s.data && s.data.status;
        if (st === 'completed' || st === 'done') {
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            const res = (s.data.result) || {};
            log('  完成 耗时=' + secs + 's 实际轮次=' + res.rounds + ' log条目=' + ((res.log || []).length));
            if (res.success === false) anomaly('pipeline.notSuccess', { ch: chapter.chapterNumber, message: res.message, failureType: res.failureType });
            return { ch: chapter.chapterNumber, ok: res.success !== false, secs: Number(secs), rounds: res.rounds, failureType: res.failureType };
        }
        // 终止态统一判定（含看门狗写入的 'timeout'，否则会一直空转轮询）
        if (['failed', 'error', 'timeout', 'cancelled'].indexOf(st) >= 0) {
            anomaly(st === 'timeout' ? 'pipeline.taskTimeout' : 'pipeline.taskFailed', { ch: chapter.chapterNumber, body: String(JSON.stringify(s.data)).substring(0, 400) });
            return { ch: chapter.chapterNumber, ok: false };
        }
        if (i % 6 === 5) log('  等待中 ' + (i * 10 + 10) + 's 状态=' + (st || '...'));
    }
    anomaly('pipeline.timeout', { ch: chapter.chapterNumber });
    return { ch: chapter.chapterNumber, ok: false };
}

(async () => {
    const desc = require('./inverseJianghuProjectDesc');
    let pid = RESUME_ID;
    try {
        if (!pid) pid = await step1_createProject(desc);
        else log('续跑项目: ' + pid);
        summary.projectId = pid;
        saveReport();

        // 复用已有项目时：没有素材/章节才补做，避免重复生成
        const matsNow = await fetchApi('GET', '/api/materials?projectId=' + pid);
        const hasMaterials = Array.isArray(matsNow.data) && matsNow.data.length > 0;
        const chsNow = await fetchApi('GET', '/api/chapters?projectId=' + pid);
        const hasChapters = Array.isArray(chsNow.data) && chsNow.data.length > 0;
        if (!hasMaterials) await step2_materials(pid, desc);
        else log('已有素材 ' + matsNow.data.length + ' 条，跳过生成');
        if (!hasChapters) await step3_outlines(pid, desc);
        else log('已有章节 ' + chsNow.data.length + ' 章，跳过大纲生成');

        const chResp = await fetchApi('GET', '/api/chapters?projectId=' + pid);
        const chapters = (Array.isArray(chResp.data) ? chResp.data : ((chResp.data && chResp.data.chapters) || []))
            .slice().sort((a, b) => a.chapterNumber - b.chapterNumber).slice(0, CHAPTERS);
        log('');
        log('=== 步骤4: 逐章执行流水线（共' + chapters.length + '章，最多' + MAX_ROUNDS + '轮） ===');
        if (chapters.length < CHAPTERS) anomaly('chapters.shortfall', { got: chapters.length, want: CHAPTERS });

        for (const ch of chapters) {
            if (ONLY && ONLY.indexOf(ch.chapterNumber) < 0) continue; // 定向复验：只跑指定章节
            // 已完成（素材已更新）的章节默认跳过；--force 可强制重跑
            if (!FORCE && ch.status === STATUS_VALUES.MATERIAL_UPDATED) {
                log('跳过第' + ch.chapterNumber + '章（已 material-updated）');
                summary.chapters.push({ ch: ch.chapterNumber, ok: true, skipped: true });
                continue;
            }
            const res = await runChapter(pid, ch);
            summary.chapters.push(res);
            await probeChapter(pid, ch);
            await probeReviews(pid, ch.id, ch.chapterNumber);
            await probeEntityCenter(pid, ch.chapterNumber);
            saveReport();
        }

        const ok = summary.chapters.filter(c => c.ok).length;
        log('');
        log('=== 完成: ' + ok + '/' + summary.chapters.length + ' 章通过 ===');
        log('异常总数: ' + anomalies.length);
        summary.finishedAt = new Date().toISOString();
        saveReport();
        console.log('PROJECT_ID=' + pid);
    } catch (e) {
        anomaly('fatal', { message: e.message, stack: String(e.stack).substring(0, 500) });
        saveReport();
        console.error('E2E 失败: ' + e.message);
        if (pid) console.error('项目ID=' + pid);
        process.exit(1);
    }
})();
