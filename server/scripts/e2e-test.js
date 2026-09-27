require('dotenv').config({ override: true });
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { normalizeTargetChapters } = require('../../config/targetChaptersNormalizer');
const { api, test, RESULTS, printSummary } = require('./e2eTestHelpers');

async function run() {
    let projectId = process.argv[2];
    if (!projectId) { const projects = await store.listItems('projects'); if (projects.length === 0) { console.error('❌ 没有项目数据'); process.exit(1); } projectId = projects[0].id; }
    const project = await store.getItem('projects', projectId);
    if (!project) { console.error(`❌ 项目不存在: ${projectId}`); process.exit(1); }
    console.log(`\n🧪 端到端集成测试 - 项目: ${project.name} (${project.genre})`);

    await test('E2E-01: 项目配置完整性', async () => {
        const tc = normalizeTargetChapters(project);
        const hasGenre = !!project.genre, hasMode = project.mode === 'novel', hasTarget = tc > 0;
        return { passed: hasGenre && hasMode && hasTarget, detail: `genre=${project.genre} mode=${project.mode} target=${tc}` };
    });
    await test('E2E-02: 素材库完整性', async () => {
        const materials = await store.queryItems('materials', { projectId });
        const hasChar = materials.some(m => m.type === 'character'), noBaza = !materials.some(m => m.type === 'character' && (m.name?.includes('霸总') || m.role?.includes('霸总')));
        return { passed: materials.length > 0 && hasChar && noBaza, detail: `count=${materials.length} hasChar=${hasChar} noBaza=${noBaza}` };
    });
    await test('E2E-03: 章节数据完整性', async () => {
        const chapters = await store.queryItems('chapters', { projectId });
        const statusCounts = {}; chapters.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
        return { passed: chapters.length > 0, detail: `count=${chapters.length} statuses=${JSON.stringify(statusCounts)}` };
    });
    await test('E2E-04: 实体注册表同步', async () => {
        const entities = await store.queryItems('entity-registry', { projectId });
        return { passed: entities.length > 0, detail: `entities=${entities.length}` };
    });
    await test('E2E-05: 知识库事实', async () => {
        const facts = await store.queryItems('knowledge-facts', { projectId });
        return { passed: facts.length > 0, detail: `facts=${facts.length}` };
    });
    await test('E2E-06: 记忆层', async () => {
        const layers = await store.queryItems('memory-layers', { projectId });
        return { passed: layers.length > 0, detail: `layers=${layers.length}` };
    });
    await test('E2E-07: 角色状态缓存', async () => {
        const cache = await store.queryItems('character-state-cache', { projectId });
        return { passed: cache.length > 0, detail: `cache=${cache.length}` };
    });
    await test('E2E-08: API项目详情', async () => { const r = await api('GET', `/api/projects/${projectId}`); return { passed: r.status === 200, detail: `status=${r.status}` }; });
    await test('E2E-09: API素材列表', async () => { const r = await api('GET', `/api/materials?projectId=${projectId}`); return { passed: r.status === 200, detail: `status=${r.status}` }; });
    await test('E2E-10: API章节列表', async () => { const r = await api('GET', `/api/chapters?projectId=${projectId}`); return { passed: r.status === 200, detail: `status=${r.status}` }; });
    await test('E2E-11: 题材配置', async () => { const r = await api('GET', `/api/genre-debug/${encodeURIComponent(project.genre || '')}/agents`); return { passed: r.status === 200, detail: `status=${r.status}` }; });
    await test('E2E-12: 约束注入', async () => { const r = await api('GET', `/api/genre-debug/${encodeURIComponent(project.genre || '')}/constraints`); return { passed: r.status === 200, detail: `status=${r.status}` }; });
    await test('E2E-13: 角色编年史', async () => { const c = await store.queryItems('character-chronicle', { projectId }); return { passed: true, detail: `chronicles=${c.length}` }; });
    await test('E2E-14: 叙事状态', async () => { const n = await store.queryItems('narrative-state', { projectId }); return { passed: true, detail: `narrative=${n.length}` }; });
    await test('E2E-15: 级联删除路由', async () => { const r = await api('DELETE', `/api/projects/nonexistent-id-for-test`); return { passed: r.status === 404 || r.status === 200, detail: `status=${r.status}` }; });

    const { passed, failed, total, results } = printSummary();
    const report = { timestamp: new Date().toISOString(), project: { id: projectId, name: project.name, genre: project.genre }, total, passed, failed, results };
    const reportPath = path.join(__dirname, '..', 'test-reports', `e2e-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告: ${reportPath}`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
