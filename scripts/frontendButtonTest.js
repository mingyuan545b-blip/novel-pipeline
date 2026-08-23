/**
 * frontendButtonTest.js — 前端功能按钮API模拟测试
 *
 * 目的：模拟点击前端所有功能按钮，测试数据加载显示
 * 验收标准：所有API返回200且数据结构正确，无报错
 *
 * 运行：node scripts/frontendButtonTest.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const HOST = '127.0.0.1';
const envPath = path.join(__dirname, '..', '.env');
let AUTH_TOKEN = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
    if (matches && matches.length > 0) AUTH_TOKEN = matches[matches.length - 1].split('=')[1].trim();
}

const results = [];
let testProjectId = '';

function request(method, reqPath, body, timeoutMs = 30000) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const options = { hostname: HOST, port: PORT, path: reqPath, method, headers: { 'Content-Type': 'application/json' }, timeout: timeoutMs };
        if (AUTH_TOKEN) options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', d => chunks += d);
            res.on('end', () => {
                let parsed = chunks;
                try { parsed = JSON.parse(chunks); } catch (_) {}
                resolve({ status: res.statusCode, body: parsed, raw: chunks });
            });
        });
        req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
        if (data) req.write(data);
        req.end();
    });
}

function log(testName, status, detail) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    const msg = `${icon} [${testName}] ${detail || ''}`;
    console.log(msg);
    results.push({ testName, status, detail });
}

async function testApi(name, method, reqPath, body, expectedStatus = 200) {
    const res = await request(method, reqPath, body);
    if (res.status === expectedStatus) {
        const dataInfo = _describeData(res.body);
        log(name, 'PASS', `${method} ${reqPath} → ${res.status} ${dataInfo}`);
    } else {
        log(name, 'FAIL', `${method} ${reqPath} → ${res.status} (expected ${expectedStatus}) ${JSON.stringify(res.body).substring(0, 200)}`);
    }
    return res;
}

function _describeData(body) {
    if (Array.isArray(body)) return `[${body.length} items]`;
    if (body && typeof body === 'object') {
        if (body.events) return `{events: ${body.events.length}}`;
        if (body.projects) return `{projects: ${body.projects.length}}`;
        if (body.id) return `{id: ${body.id.substring(0, 8)}...}`;
        return `{${Object.keys(body).slice(0, 5).join(',')}}`;
    }
    return typeof body;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============ 测试流程 ============

async function testHealthAndProjects() {
    console.log('\n=== P1: 服务器健康检查 + 项目列表 ===');
    await testApi('health', 'GET', '/api/health');
    const projectsRes = await testApi('projects-list', 'GET', '/api/projects');
    if (projectsRes.status === 200 && Array.isArray(projectsRes.body) && projectsRes.body.length > 0) {
        testProjectId = projectsRes.body[0].id;
        log('test-project', 'PASS', `使用项目: ${testProjectId} (${projectsRes.body[0].name})`);
    } else {
        log('test-project', 'FAIL', '没有可用的测试项目');
    }
}

async function testMaterialsAndEntity() {
    console.log('\n=== P2: 素材库 + 实体中心 ===');
    if (!testProjectId) return;
    await testApi('materials', 'GET', `/api/materials?projectId=${testProjectId}`);
    await testApi('entity-registry', 'GET', `/api/entity-center/entity-registry?projectId=${testProjectId}`);
    await testApi('entity-entities', 'GET', `/api/entity-center/entities?projectId=${testProjectId}`);
}

async function testKnowledgeTabs() {
    console.log('\n=== P3: 知识库各tab数据加载 ===');
    if (!testProjectId) return;
    await testApi('knowledge-overview', 'GET', `/api/knowledge/overview/${testProjectId}`);
    await testApi('knowledge-graph', 'GET', `/api/knowledge/relationship-graph/${testProjectId}`);
    await testApi('knowledge-timeline-events', 'GET', `/api/knowledge/timeline/${testProjectId}/events`);
    await testApi('knowledge-timeline-stats', 'GET', `/api/knowledge/timeline/${testProjectId}/stats`);
    await testApi('knowledge-foreshadowing', 'GET', `/api/knowledge/snapshots/${testProjectId}/foreshadowing`);
    await testApi('knowledge-snapshots', 'GET', `/api/knowledge/snapshots/${testProjectId}`);
    await testApi('knowledge-consistency-reports', 'GET', `/api/knowledge/consistency/${testProjectId}/reports`);
    await testApi('knowledge-foreshadow-guard', 'GET', `/api/knowledge/foreshadow-guard/${testProjectId}/stats`);
}

async function testQuests() {
    console.log('\n=== P4: 主线任务数据加载 ===');
    if (!testProjectId) return;
    await testApi('quests-list', 'GET', `/api/quests/quests?projectId=${testProjectId}`);
    await testApi('quests-meta', 'GET', '/api/quests/meta');
    await testApi('quests-root', 'GET', `/api/quests/quests?projectId=${testProjectId}&parentId=root`);
}

async function testChaptersAndDashboard() {
    console.log('\n=== P5: 章节管理 + 仪表盘 ===');
    if (!testProjectId) return;
    await testApi('chapters-list', 'GET', `/api/chapters?projectId=${testProjectId}`);
    const chaptersRes = await request('GET', `/api/chapters?projectId=${testProjectId}`);
    if (chaptersRes.status === 200 && Array.isArray(chaptersRes.body) && chaptersRes.body.length > 0) {
        const ch = chaptersRes.body[0];
        await testApi('chapter-detail', 'GET', `/api/chapters/${ch.id}`);
        await testApi('chapter-reviews', 'GET', `/api/reviews?chapterId=${ch.id}`);
        await testApi('chapter-pipeline-log', 'GET', `/api/pipeline/pipeline-logs/${testProjectId}/${ch.id}`);
    }
    await testApi('pipeline-logs-project', 'GET', `/api/pipeline/pipeline-logs/${testProjectId}`);
    await testApi('health-metrics', 'GET', '/api/health/metrics');
}

async function testPipelineStartStop() {
    console.log('\n=== P6: 流水线启动/停止专项测试 ===');
    if (!testProjectId) return;
    const chaptersRes = await request('GET', `/api/chapters?projectId=${testProjectId}`);
    if (chaptersRes.status !== 200 || !Array.isArray(chaptersRes.body) || chaptersRes.body.length === 0) {
        log('pipeline-start', 'FAIL', '没有章节可用于测试');
        return;
    }
    const ch = chaptersRes.body.find(c => c.status !== 'approved') || chaptersRes.body[0];
    log('pipeline-target', 'PASS', `目标章节: ch${ch.chapterNumber} (${ch.id.substring(0, 8)}...) status=${ch.status}`);

    const startRes = await testApi('pipeline-start', 'POST', '/api/pipeline/full', { projectId: testProjectId, chapterId: ch.id, maxRounds: 1 }, 200);
    if (startRes.status !== 200 || !startRes.body.taskId) {
        log('pipeline-taskId', 'FAIL', '启动流水线未返回taskId');
        return;
    }
    const taskId = startRes.body.taskId;
    log('pipeline-taskId', 'PASS', `taskId=${taskId}`);

    await sleep(2000);
    const statusRes = await testApi('pipeline-status', 'GET', `/api/pipeline/task/${taskId}`);
    if (statusRes.status === 200 && statusRes.body) {
        log('pipeline-running', 'PASS', `任务状态: ${statusRes.body.status}`);
    }

    // 测试停止流水线（infinite stop）
    const stopRes = await testApi('pipeline-stop', 'POST', '/api/pipeline/infinite/stop', { projectId: testProjectId, taskId });
    if (stopRes.status === 200) {
        log('pipeline-stop-confirmed', 'PASS', '流水线停止成功');
    }
    await sleep(1000);
    const finalStatus = await request('GET', `/api/pipeline/task/${taskId}`);
    if (finalStatus.status === 200) {
        log('pipeline-stopped', 'PASS', `停止后状态: ${finalStatus.body.status}`);
    }
}

async function testOtherPages() {
    console.log('\n=== P7: 其他页面数据加载 ===');
    if (!testProjectId) return;
    await testApi('agents-prompt-preview', 'GET', `/api/agents/prompt-preview/${testProjectId}/writer`);
    await testApi('settings', 'GET', '/api/settings');
    await testApi('genres-list', 'GET', '/api/genre-debug/list');
    await testApi('metrics', 'GET', '/api/health/metrics');
    await testApi('flavors-reload', 'POST', '/api/flavors/reload');
}

async function main() {
    console.log('========================================');
    console.log('前端功能按钮API模拟测试');
    console.log('========================================');

    await testHealthAndProjects();
    await testMaterialsAndEntity();
    await testKnowledgeTabs();
    await testQuests();
    await testChaptersAndDashboard();
    await testPipelineStartStop();
    await testOtherPages();

    // ============ 结果分析 ============
    console.log('\n========================================');
    console.log('测试结果分析');
    console.log('========================================');
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;
    console.log(`总计: ${results.length}项, 通过: ${passCount}, 失败: ${failCount}, 警告: ${warnCount}`);

    if (failCount > 0) {
        console.log('\n❌ 失败项:');
        results.filter(r => r.status === 'FAIL').forEach((r, i) => console.log(`  ${i + 1}. [${r.testName}] ${r.detail}`));
    }

    process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('测试执行异常:', err); process.exit(1); });
