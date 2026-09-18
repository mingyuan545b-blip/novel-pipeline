/**
 * verifyFiveChapterE2E.js — 新项目 5 章端到端结果核验
 * 用法: node scripts/verifyFiveChapterE2E.js <projectId> [章节数=5]
 * 核验：章节产出/状态、素材库更新、实体中心、知识库、伏笔、上下文装配记录、前后端API
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const store = require('../server/store');

const PROJECT_ID = process.argv[2];
const CHAPTERS = Number(process.argv[3]) || 5;
const MIN_CHARS = Number(process.env.E2E_MIN_CHAPTER_CHARS) || 1500;
if (!PROJECT_ID) { console.error('用法: node scripts/verifyFiveChapterE2E.js <projectId> [章节数]'); process.exit(1); }

const rows = [];
const mark = { ok: 'OK  ', warn: 'WARN', bad: 'FAIL' };
function rec(area, name, level, detail) { rows.push({ area, name, level, detail }); }

function apiGet(path) {
    return new Promise((resolve) => {
        const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'GET',
            headers: { Authorization: 'Bearer ' + (process.env.REQUEST_SECRET || '') }, timeout: 20000 }, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
        req.end();
    });
}

async function checkChapters() {
    const chapters = (await store.queryItems('chapters', { projectId: PROJECT_ID }))
        .sort((a, b) => a.chapterNumber - b.chapterNumber).slice(0, CHAPTERS);
    rec('章节产出', '章节数', chapters.length >= CHAPTERS ? 'ok' : 'bad', chapters.length + '/' + CHAPTERS);
    for (const c of chapters) {
        const len = (c.content || '').length;
        rec('章节产出', 'ch' + c.chapterNumber + ' 正文', len >= MIN_CHARS ? 'ok' : (len > 0 ? 'warn' : 'bad'),
            len + '字 状态=' + c.status);
    }
    const withContent = chapters.filter((c) => (c.content || '').length >= MIN_CHARS).length;
    rec('章节产出', '达标章数', withContent >= CHAPTERS ? 'ok' : 'warn', withContent + '/' + CHAPTERS);
    return chapters;
}

async function checkStores() {
    const materials = await store.queryItems('materials', { projectId: PROJECT_ID });
    const byType = {};
    for (const m of materials) byType[m.type] = (byType[m.type] || 0) + 1;
    rec('素材库', '素材总数', materials.length > 0 ? 'ok' : 'bad', materials.length + ' 条 ' + JSON.stringify(byType));
    const fsMats = materials.filter((m) => m.type === 'foreshadowing');
    rec('素材库', '伏笔素材', fsMats.length > 0 ? 'ok' : 'warn', fsMats.length + ' 条');
    const chars = materials.filter((m) => m.type === 'character');
    const deepChars = chars.filter((m) => ((m.currentContent || '').length >= 400));
    rec('素材库', '角色素材深度', deepChars.length > 0 ? 'ok' : 'warn',
        deepChars.length + '/' + chars.length + ' 个角色 ≥400字');

    const entities = await store.queryItems('entities', { projectId: PROJECT_ID });
    rec('实体中心', '实体数', entities.length > 0 ? 'ok' : 'bad', entities.length + ' 条');
    const withBrief = entities.filter((e) => (e.briefText || '').length > 0);
    rec('实体中心', '预计算提示词', withBrief.length > 0 ? 'ok' : 'warn',
        withBrief.length + '/' + entities.length + ' 有 briefText');

    const facts = await store.queryItems('knowledge-facts', { projectId: PROJECT_ID });
    rec('知识库', '记忆金字塔事实', facts.length > 0 ? 'ok' : 'warn', facts.length + ' 条');
    const access = await store.queryItems('knowledge-access', { projectId: PROJECT_ID });
    rec('知识库', '限知认知', access.length > 0 ? 'ok' : 'warn', access.length + ' 条');
    const rels = await store.queryItems('character-relations', { projectId: PROJECT_ID });
    rec('实体中心', '人物关系', rels.length > 0 ? 'ok' : 'warn', rels.length + ' 条');
    const tl = await store.queryItems('timeline-events', { projectId: PROJECT_ID });
    rec('时间轴', '事件数', tl.length > 0 ? 'ok' : 'warn', tl.length + ' 条');
}

async function checkAssemblyRecords(chapters) {
    const { getContextTraceForProject } = require('../server/services/contextTrace');
    const trace = getContextTraceForProject(PROJECT_ID);
    let withAssembly = 0;
    const detail = [];
    for (const c of chapters) {
        const asm = await trace.getChapterAssemblies(c.chapterNumber);
        const writers = asm.writer;
        if (writers && writers.summary && writers.summary.injectedTypes > 0) {
            withAssembly++;
            detail.push('ch' + c.chapterNumber + ':' + writers.summary.injectedTypes + '类/' + writers.summary.actualChars + '字');
        }
    }
    rec('上下文装配图', '有装配记录的章节', withAssembly >= CHAPTERS ? 'ok' : (withAssembly > 0 ? 'warn' : 'bad'),
        withAssembly + '/' + CHAPTERS + ' ' + detail.join(' '));

    const last = chapters[chapters.length - 1];
    if (last) {
        const asm = await trace.getChapterAssemblies(last.chapterNumber);
        const w = asm.writer;
        if (w) {
            rec('上下文装配图', '末章预算状态', w.budget && w.budget.level ? 'ok' : 'warn',
                (w.budget ? w.budget.label + '(' + w.budget.level + ')' : '-'));
            const dropped = (w.types || []).filter((t) => t.status === 'dropped').map((t) => t.type);
            const injected = (w.types || []).filter((t) => t.status === 'injected').map((t) => t.type);
            rec('上下文装配图', '末章装配明细', injected.length > 0 ? 'ok' : 'warn',
                '注入[' + injected.join(',') + '] 丢弃[' + dropped.length + '类]');
            const empty = (w.types || []).filter((t) => t.status === 'empty').map((t) => t.type);
            rec('上下文装配图', '末章空数据告警', empty.length === 0 ? 'ok' : 'warn', empty.join(',') || '无');
        }
    }
}

async function checkHooksAndAudit() {
    try {
        const { getHookBudgetForProject } = require('../server/services/hookBudget');
        const hooks = await getHookBudgetForProject(PROJECT_ID).getActiveHooks();
        rec('伏笔系统', '活跃Hook', hooks.length > 0 ? 'ok' : 'warn', hooks.length + ' 个');
    } catch (e) { rec('伏笔系统', 'Hook读取', 'bad', e.message); }
    try {
        const { getDataContext } = require('../server/services/dataContext');
        const ctx = await getDataContext(PROJECT_ID);
        const tl = await ctx.getTimelineSummary(CHAPTERS);
        rec('守卫/审计', '时间线摘要', tl && tl.length > 0 ? 'ok' : 'warn', (tl || '').length + '字');
    } catch (e) { rec('守卫/审计', '时间线摘要', 'bad', e.message); }
}

async function checkFrontendApis(chapters) {
    const eps = [
        ['项目详情', '/api/projects/' + PROJECT_ID],
        ['章节列表', '/api/chapters?projectId=' + PROJECT_ID],
        ['素材库', '/api/materials?projectId=' + PROJECT_ID],
        ['实体中心', '/api/entity-center/entities?projectId=' + PROJECT_ID],
        ['知识库·限知认知', '/api/knowledge/knowledge-access?projectId=' + PROJECT_ID],
        ['知识库·记忆层', '/api/knowledge/memory/' + PROJECT_ID + '/layers'],
        ['知识库·一致性报告', '/api/knowledge/consistency/' + PROJECT_ID + '/reports'],
        ['上下文装配图', '/api/pipeline/context-assembly/' + PROJECT_ID + '?chapterNumber=' + CHAPTERS],
    ];
    for (const [label, path] of eps) {
        const r = await apiGet(path);
        rec('前端API', label, r.status === 200 ? 'ok' : 'bad', 'HTTP ' + r.status);
    }
    const last = chapters[chapters.length - 1];
    if (last) {
        const r = await apiGet('/api/chapters/' + last.id);
        let hasContent = false;
        try { hasContent = (JSON.parse(r.body).content || '').length > 0; } catch (e) { hasContent = false; }
        rec('前端API', '末章正文回读', hasContent ? 'ok' : 'bad', 'HTTP ' + r.status + ' 有正文=' + hasContent);
    }
}

(async () => {
    console.log('\n=== 5章E2E核验 project=' + PROJECT_ID + ' ===');
    const chapters = await checkChapters();
    await checkStores();
    await checkAssemblyRecords(chapters);
    await checkHooksAndAudit();
    await checkFrontendApis(chapters);

    let cur = '';
    for (const r of rows) {
        if (r.area !== cur) { cur = r.area; console.log('\n【' + cur + '】'); }
        console.log('  [' + mark[r.level] + '] ' + r.name.padEnd(20) + ' ' + r.detail);
    }
    const bad = rows.filter((r) => r.level === 'bad').length;
    const warn = rows.filter((r) => r.level === 'warn').length;
    console.log('\n=== 汇总: ' + rows.length + ' 项 | OK ' + (rows.length - bad - warn) + ' | WARN ' + warn + ' | FAIL ' + bad + ' ===\n');
    process.exit(bad > 0 ? 1 : 0);
})().catch((e) => { console.error('核验失败:', e.message); process.exit(1); });
