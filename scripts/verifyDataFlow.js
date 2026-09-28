/**
 * verifyDataFlow.js — 功能数据流通核查（只读，不调用LLM）
 * 用法: node scripts/verifyDataFlow.js <projectId> [chapterNumber]
 * 核查：素材库/实体中心/知识库 → 上下文决策 → 素材调度 → Agent提示词装配
 *      + 长期记忆、技法、守卫、前端关键API
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const store = require('../server/store');

const PROJECT_ID = process.argv[2];
const CHAPTER = Number(process.argv[3]) || 1;
if (!PROJECT_ID) { console.error('用法: node scripts/verifyDataFlow.js <projectId> [chapterNumber]'); process.exit(1); }

const results = [];
const mark = { ok: 'OK  ', warn: 'WARN', bad: 'FAIL' };
function record(area, name, level, detail) { results.push({ area, name, level, detail }); }

function apiGet(path) {
    return new Promise((resolve) => {
        const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'GET',
            headers: { Authorization: 'Bearer ' + (process.env.REQUEST_SECRET || '') }, timeout: 15000 }, (res) => {
            let d = '';
            res.on('data', (c) => { d += c; });
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', (e) => resolve({ status: 0, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
        req.end();
    });
}

async function checkStorage() {
    const tables = [
        ['materials', '素材库'], ['entities', '实体中心'], ['chapters', '章节'],
        ['knowledge-access', '知识库·限知认知'], ['knowledge-facts', '知识库·记忆金字塔'],
        ['character-relations', '实体关系'], ['timeline-events', '时间轴'],
    ];
    for (const [t, label] of tables) {
        try {
            const rows = await store.queryItems(t, { projectId: PROJECT_ID });
            record('存储层', label, rows.length > 0 ? 'ok' : 'warn', rows.length + ' 条');
        } catch (e) { record('存储层', label, 'bad', '查询失败: ' + e.message); }
    }
}

async function checkDecisionAndScheduling() {
    const { resolveContext } = require('../server/services/pipeline/contextCommander');
    const { assembleMaterialState } = require('../server/services/pipeline/materialStateAssembler');
    const { getDataContext } = require('../server/services/dataContext');
    const ctx = await getDataContext(PROJECT_ID);
    const project = await ctx.getProject();
    const genre = await ctx.getGenre();
    const materials = await ctx.getActiveMaterials();
    const chapters = await store.queryItems('chapters', { projectId: PROJECT_ID });
    const chapter = chapters.find((c) => c.chapterNumber === CHAPTER) || chapters[0];

    const decision = await resolveContext('writer', { projectId: PROJECT_ID, chapter, materials, project, genre });
    const kept = decision.materialNeeds.filter((n) => !n.dropped);
    record('上下文决策', '相关性门控', kept.length > 0 ? 'ok' : 'bad',
        '保留' + kept.length + '/声明' + decision.materialNeeds.length + '类');
    record('上下文决策', '场景识别', decision.meta.sceneTypes.length > 0 ? 'ok' : 'warn',
        JSON.stringify(decision.meta.sceneTypes));
    const hasIntent = Boolean(decision.intentResult && decision.intentResult.intent);
    record('上下文决策', '章节意图接入', hasIntent ? 'ok' : 'warn', hasIntent ? '意图已参与决策' : '无意图');
    const bs = decision.budgetAssessment || {};
    record('上下文决策', '预算评估', bs.status ? 'ok' : 'bad',
        (bs.status ? bs.status.label : '-') + ' ratio=' + Number(bs.ratio).toFixed(2));

    const scheduled = await assembleMaterialState('writer', { projectId: PROJECT_ID, chapter, materials, ctx, project, genre });
    record('素材调度', '实际装载', scheduled.stats.loaded > 0 ? 'ok' : 'bad',
        scheduled.stats.loaded + ' 条 / ' + scheduled.stats.actualChars + ' 字');
    record('素材调度', '约束注入', scheduled.constraints && scheduled.constraints.text ? 'ok' : 'bad',
        ((scheduled.constraints && scheduled.constraints.text) ? scheduled.constraints.text.length : 0) + ' 字');
    const rep = scheduled.report || { summary: {}, gaps: [], provenance: [] };
    const blocked = rep.gaps.filter((g) => g.level === 'blocked');
    record('装配记账(P1-4c)', '缺口分级', blocked.length === 0 ? 'ok' : 'warn',
        'blocked ' + blocked.length + ' / warn ' + (rep.summary.gapWarn || 0) + (blocked.length ? ' → ' + blocked.map((g) => g.type + ':' + g.reason).join(',') : ''));
    const traced = rep.provenance.filter((x) => x.lastWriter).length;
    record('装配记账(P1-4c)', '来源追溯', rep.provenance.length > 0 ? 'ok' : 'warn',
        rep.provenance.length + ' 条，留痕 ' + traced + ' 条');
}

async function checkPromptAssembly() {
    try {
        const { assembleAgentPrompt } = require('../server/services/prompts/agentPromptAssembler');
        const asm = await assembleAgentPrompt('writer', 'novel', PROJECT_ID, { chapterNumber: CHAPTER });
        const logs = (asm && asm.buildLog) ? asm.buildLog : [];
        for (const slot of ['constraints', 'genre-foundation', 'style-profile', 'memory-pyramid']) {
            const hit = logs.find((s) => s.slot === slot);
            record('提示词装配', slot, hit ? 'ok' : 'warn', hit ? hit.chars + ' 字' : '未出现在writer槽位');
        }
        const sysLen = (asm && asm.system) ? asm.system.length : 0;
        record('提示词装配', 'system总长', sysLen > 2000 ? 'ok' : 'warn', sysLen + ' 字');
        record('提示词装配', '槽位清单', 'ok', logs.map((s) => s.slot).join(','));
    } catch (e) { record('提示词装配', 'assembler', 'bad', e.message); }
}

async function checkMemoryAndTech() {
    try {
        const { memoryPyramid } = require('../server/services/knowledgeBase');
        const facts = await memoryPyramid.getFactsForPrompt(PROJECT_ID, CHAPTER, 1500);
        record('长期记忆', '记忆金字塔(M0-M3)', facts.length > 0 ? 'ok' : 'warn', facts.length + ' 条事实');
    } catch (e) { record('长期记忆', '记忆金字塔', 'bad', e.message); }
    try {
        const memory = require('../server/services/memory');
        const layers = await memory.getMemoryLayers(PROJECT_ID);
        const names = Object.keys(layers);
        record('分层记忆(L0-L4)', 'prompt接入', 'warn',
            names.length > 0 ? '已生成[' + names.join('/') + ']，但无prompt路径读取（仅UI展示，冗余）' : '未生成');
    } catch (e) { record('分层记忆(L0-L4)', '读取', 'warn', e.message); }
    try {
        const { scheduleTechniques } = require('../server/services/pipeline/techniqueScheduler');
        const tech = scheduleTechniques({ agentType: 'writer', mode: 'novel',
            sceneTypes: [{ scene: 'combat' }], phase: 'development', outlineText: '战斗', maxTokens: 600 });
        record('藏经阁技法', '技法调度', tech.techniques.length > 0 ? 'ok' : 'warn',
            '选中' + tech.techniques.length + '个 / prompt ' + tech.formattedPrompt.length + '字');
    } catch (e) { record('藏经阁技法', '技法调度', 'bad', e.message); }
}

async function checkGuards() {
    const { getDataContext } = require('../server/services/dataContext');
    const ctx = await getDataContext(PROJECT_ID);
    const checks = [
        ['时间线矛盾', () => ctx.detectTimelineConflicts(CHAPTER)],
        ['战力一致性', () => ctx.getPowerCheckHint(CHAPTER)],
        ['伏笔提示', () => ctx.getForeshadowCheckHint(CHAPTER)],
        ['角色弧线', () => ctx.getCharacterArcCheckHint(CHAPTER)],
        ['角色活跃度', () => ctx.getCharacterActivityHint(CHAPTER)],
        ['时间线摘要', () => ctx.getTimelineSummary(CHAPTER)],
    ];
    for (const [label, fn] of checks) {
        try {
            const v = await fn();
            const len = typeof v === 'string' ? v.length : (Array.isArray(v) ? v.length : (v ? 1 : 0));
            record('守卫/审计', label, len > 0 ? 'ok' : 'warn', len > 0 ? '有输出(' + len + ')' : '无输出');
        } catch (e) { record('守卫/审计', label, 'bad', e.message); }
    }
}

async function checkFrontendApis() {
    const endpoints = [
        ['项目列表', '/api/projects'],
        ['章节列表', '/api/chapters?projectId=' + PROJECT_ID],
        ['素材库', '/api/materials?projectId=' + PROJECT_ID],
        ['上下文装配图', '/api/pipeline/context-assembly/' + PROJECT_ID + '?chapterNumber=' + CHAPTER],
    ];
    for (const [label, path] of endpoints) {
        const r = await apiGet(path);
        record('前端API', label, r.status === 200 ? 'ok' : 'bad', 'HTTP ' + r.status);
    }
}

(async () => {
    console.log('\n=== 数据流通核查 project=' + PROJECT_ID + ' chapter=' + CHAPTER + ' ===');
    await checkStorage();
    await checkDecisionAndScheduling();
    await checkPromptAssembly();
    await checkMemoryAndTech();
    await checkGuards();
    await checkFrontendApis();
    let cur = '';
    for (const r of results) {
        if (r.area !== cur) { cur = r.area; console.log('\n【' + cur + '】'); }
        console.log('  [' + mark[r.level] + '] ' + r.name.padEnd(20) + ' ' + r.detail);
    }
    const bad = results.filter((r) => r.level === 'bad').length;
    const warn = results.filter((r) => r.level === 'warn').length;
    const okCount = results.length - bad - warn;
    console.log('\n=== 汇总: ' + results.length + ' 项 | OK ' + okCount + ' | WARN ' + warn + ' | FAIL ' + bad + ' ===\n');
    process.exit(0);
})().catch((e) => { console.error('核查失败:', e.message); process.exit(1); });
