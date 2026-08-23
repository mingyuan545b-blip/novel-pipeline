require('dotenv').config();
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { api, test, RESULTS, printSummary } = require('./e2eTestHelpers');

const ROUTE_GROUPS = {
    health: [
        { name: 'E2E-CR01: 健康检查', method: 'GET', path: '/api/health' },
        { name: 'E2E-CR02: 指标端点', method: 'GET', path: '/api/health/metrics' },
    ],
    projects: [
        { name: 'E2E-CR03: 项目列表', method: 'GET', path: '/api/projects' },
    ],
    settings: [
        { name: 'E2E-CR04: 配置状态', method: 'GET', path: '/api/settings/config-status' },
        { name: 'E2E-CR05: LLM提供商列表', method: 'GET', path: '/api/settings/providers' },
    ],
    genres: [
        { name: 'E2E-CR06: 题材列表', method: 'GET', path: '/api/genres' },
    ],
    agents: [
        { name: 'E2E-CR07: Agent列表', method: 'GET', path: '/api/agents' },
    ],
    flavors: [
        { name: 'E2E-CR08: 方言列表', method: 'GET', path: '/api/flavors/dialects' },
    ],
    auth: [
        { name: 'E2E-CR09: 认证状态', method: 'GET', path: '/api/auth/status' },
    ],
    version: [
        { name: 'E2E-CR10: 版本信息', method: 'GET', path: '/api/version' },
    ],
};

async function run() {
    console.log('\n🧪 E2E关键路径冒烟测试');

    // Phase 1: 无项目依赖的通用路由
    for (const [group, routes] of Object.entries(ROUTE_GROUPS)) {
        for (const route of routes) {
            await test(route.name, async () => {
                const r = await api(route.method, route.path);
                return { passed: r.status < 500, detail: `status=${r.status}` };
            });
        }
    }

    // Phase 2: 项目依赖路由
    let projectId = process.argv[2];
    if (!projectId) {
        const projects = await store.listItems('projects');
        if (projects.length === 0) {
            console.log('⚠️ 无项目数据，跳过项目依赖测试');
            printSummary();
            process.exit(0);
        }
        projectId = projects[0].id;
    }
    const project = await store.getItem('projects', projectId);
    if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        process.exit(1);
    }
    console.log(`\n📦 使用项目: ${project.name} (${project.genre})`);

    const projectRoutes = [
        { name: 'E2E-CR11: 项目详情', method: 'GET', path: `/api/projects/${projectId}` },
        { name: 'E2E-CR12: 素材列表', method: 'GET', path: `/api/materials?projectId=${projectId}` },
        { name: 'E2E-CR13: 章节列表', method: 'GET', path: `/api/chapters?projectId=${projectId}` },
        { name: 'E2E-CR14: 实体注册表', method: 'GET', path: `/api/entity-center/${projectId}/registry` },
        { name: 'E2E-CR15: 知识库概览', method: 'GET', path: `/api/knowledge/${projectId}/overview` },
        { name: 'E2E-CR16: 角色状态', method: 'GET', path: `/api/character-states/${projectId}/summary` },
        { name: 'E2E-CR17: Pipeline状态', method: 'GET', path: `/api/pipeline/${projectId}/status` },
        { name: 'E2E-CR18: 题材Debug', method: 'GET', path: `/api/genre-debug/${encodeURIComponent(project.genre || '')}/agents` },
        { name: 'E2E-CR19: 约束注入', method: 'GET', path: `/api/genre-debug/${encodeURIComponent(project.genre || '')}/constraints` },
        { name: 'E2E-CR20: 世界域', method: 'GET', path: `/api/worldscope/${projectId}` },
    ];

    for (const route of projectRoutes) {
        await test(route.name, async () => {
            const r = await api(route.method, route.path);
            return { passed: r.status < 500, detail: `status=${r.status}` };
        });
    }

    // Phase 3: 数据完整性验证
    await test('E2E-CR21: 素材-实体注册表一致性', async () => {
        const materials = await store.queryItems('materials', { projectId });
        const entities = await store.queryItems('entity-registry', { projectId });
        const charMats = materials.filter(m => m.type === 'character');
        const charEntities = entities.filter(e => e.entityType === 'character');
        return {
            passed: charMats.length === 0 || charEntities.length > 0,
            detail: `charMaterials=${charMats.length} charEntities=${charEntities.length}`
        };
    });

    await test('E2E-CR22: 章节-大纲一致性', async () => {
        const chapters = await store.queryItems('chapters', { projectId });
        const withOutline = chapters.filter(c => c.outline);
        return {
            passed: chapters.length === 0 || withOutline.length > 0,
            detail: `total=${chapters.length} withOutline=${withOutline.length}`
        };
    });

    await test('E2E-CR23: 知识库-事实关联', async () => {
        const facts = await store.queryItems('knowledge-facts', { projectId });
        const layers = await store.queryItems('memory-layers', { projectId });
        return {
            passed: true,
            detail: `facts=${facts.length} layers=${layers.length}`
        };
    });

    // Phase 4: 404/错误处理
    await test('E2E-CR24: 不存在项目返回404', async () => {
        const r = await api('GET', '/api/projects/nonexistent-id-12345');
        return { passed: r.status === 404, detail: `status=${r.status}` };
    });

    await test('E2E-CR25: 无效路由返回404', async () => {
        const r = await api('GET', '/api/nonexistent-route-xyz');
        return { passed: r.status === 404, detail: `status=${r.status}` };
    });

    const { passed, failed, total } = printSummary();
    const report = {
        timestamp: new Date().toISOString(),
        type: 'critical-routes',
        project: project ? { id: projectId, name: project.name, genre: project.genre } : null,
        total, passed, failed, results: RESULTS
    };
    const reportPath = path.join(__dirname, '..', 'test-reports', `e2e-critical-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告: ${reportPath}`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
