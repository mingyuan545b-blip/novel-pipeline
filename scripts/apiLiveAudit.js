/**
 * apiLiveAudit.js
 * 对运行中的服务器做实际API端点可达性测试
 * 只测试前端实际调用的关键端点（无项目依赖的通用端点）
 */
const http = require('http');

const BASE = 'http://localhost:3001';

async function fetchUrl(url) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, url }));
        });
        req.on('error', () => resolve({ status: 0, url }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, url }); });
    });
}

async function main() {
    // 通用端点（不需要projectId等参数）
    const endpoints = [
        // 核心功能
        ['GET', '/api/projects'],
        ['GET', '/api/settings'],
        ['GET', '/api/pipeline/agents?mode=novel'],
        ['GET', '/api/genre-debug/list'],
        ['GET', '/api/genre-debug/constraint-modules'],
        ['GET', '/api/chapter-audit/models'],
        ['GET', '/api/health'],
        ['GET', '/api/license/status'],
        ['GET', '/api/version'],
        ['GET', '/api/guide'],
        ['GET', '/api/comic/comfyui-status'],

        // agents
        ['GET', '/api/agents'],

        // flavors
        ['GET', '/api/flavors/dialects'],
        ['GET', '/api/flavors/speech-styles'],
        ['GET', '/api/flavors/naming-styles'],
        ['GET', '/api/flavors/meme-lexicon'],
        ['GET', '/api/flavors/humor-devices'],
        ['GET', '/api/flavors/worldview-templates'],
        ['GET', '/api/flavors/character-archetypes'],
        ['GET', '/api/flavors/genre-profiles'],
        ['GET', '/api/flavors/system-personas'],

        // prompt-config
        ['GET', '/api/prompt-config/agent-templates'],
        ['GET', '/api/prompt-config/style-profiles'],
        ['GET', '/api/prompt-config/constraint-presets'],
        ['GET', '/api/prompt-config/foundation-prompts'],

        // knowledge
        ['GET', '/api/knowledge/overview/test-project'],

        // entity-center
        ['GET', '/api/entity-center/entity-registry'],
        ['GET', '/api/entity-center/item-definitions'],
        ['GET', '/api/entity-center/character-binds'],
        ['GET', '/api/entity-center/character-relations'],

        // chapters/materials
        ['GET', '/api/chapters?projectId=test'],
        ['GET', '/api/materials'],
        ['GET', '/api/materials/types'],
        ['GET', '/api/reviews'],

        // style-templates
        ['GET', '/api/style-templates/templates'],

        // quests
        ['GET', '/api/quests/quests'],
        ['GET', '/api/quests/timelines'],
        ['GET', '/api/quests/meta'],

        // worldview-profiles
        ['GET', '/api/worldview-profiles'],

        // franchises
        ['GET', '/api/franchises'],

        // library
        ['GET', '/api/library/index'],
        ['GET', '/api/library/departments'],
        ['GET', '/api/library/stats'],

        // map
        ['GET', '/api/map/levels'],

        // publish
        ['GET', '/api/publish/platforms'],

        // pipeline tools
        ['GET', '/api/pipeline/preflight/diagnose'],
        ['GET', '/api/pipeline/preflight/contracts'],
        ['GET', '/api/pipeline/preflight/errors'],
        ['GET', '/api/pipeline/prompt-audit-latest'],

        // character-states
        ['GET', '/api/character-states/states/test-project'],

        // api-keys
        ['GET', '/api/api-keys'],
        ['GET', '/api/api-keys/agent-bindings'],
        ['GET', '/api/api-keys/providers'],

        // admin
        ['GET', '/api/admin/users'],

        // 已知不存在的路由（确认404）
        ['GET', '/api/pipeline/output-paths/test-project/test-chapter'],
    ];

    console.log('测试', endpoints.length, '个API端点...\n');

    const results = { ok: [], notFound: [], serverError: [], connectionError: [] };

    for (const [method, path] of endpoints) {
        const url = BASE + path;
        const result = await fetchUrl(url);
        const entry = { method, path, status: result.status };

        if (result.status >= 200 && result.status < 300) results.ok.push(entry);
        else if (result.status === 404) results.notFound.push(entry);
        else if (result.status >= 500) results.serverError.push(entry);
        else results.connectionError.push(entry);
    }

    console.log('=== 200 OK ===');
    console.log('共', results.ok.length, '个');
    results.ok.forEach(r => console.log('  ✅', r.method, r.path));

    console.log('\n=== 404 NOT FOUND（前端调了但后端没有）===');
    console.log('共', results.notFound.length, '个');
    results.notFound.forEach(r => console.log('  ❌', r.method, r.path));

    console.log('\n=== 500 SERVER ERROR（后端有路由但执行报错）===');
    console.log('共', results.serverError.length, '个');
    results.serverError.forEach(r => console.log('  ⚠️', r.method, r.path));

    console.log('\n=== CONNECTION ERROR ===');
    console.log('共', results.connectionError.length, '个');
    results.connectionError.forEach(r => console.log('  🔌', r.method, r.path));

    console.log('\n=== 总计 ===');
    console.log('OK:', results.ok.length, '/ 404:', results.notFound.length, '/ 500:', results.serverError.length, '/ 连接错误:', results.connectionError.length);
}

main().catch(console.error);
