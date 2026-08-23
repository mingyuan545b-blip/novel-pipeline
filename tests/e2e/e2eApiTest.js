/**
 * e2eApiTest.js
 * 端到端API路径测试 — 启动服务器并验证核心API端点可用
 * 运行方式: 先启动服务器（npm start），再执行 node tests/e2e/e2eApiTest.js
 *
 * 注意：此测试需要运行中的服务器（localhost:3001），不在 CI 中自动运行。
 * CI 中仅运行 e2eSmokeTest.js（模块加载验证）和 perfBaseline.js（性能基线）。
 * 如需本地运行：npm start → 新终端执行 node tests/e2e/e2eApiTest.js
 */
const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TIMEOUT = 5000;

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, msg) {
    if (condition) { passed++; }
    else { failed++; errors.push(msg); }
}

function fetch(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const req = http.request(url, {
            method: options.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            timeout: TIMEOUT,
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body, headers: res.headers });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

async function testEndpoint(name, path, expectedStatus, validate) {
    try {
        const res = await fetch(path);
        const statusOk = res.status === expectedStatus;
        assert(statusOk, `${name}: expected ${expectedStatus}, got ${res.status}`);
        if (validate) {
            try {
                const data = JSON.parse(res.body);
                validate(data);
            } catch (e) {
                assert(false, `${name} body parse: ${e.message}`);
            }
        }
        console.log(`  ${statusOk ? '✅' : '❌'} ${name} → ${res.status}`);
    } catch (e) {
        assert(false, `${name}: ${e.message}`);
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

async function main() {
    console.log('\n=== E2E API 冒烟测试 ===');
    console.log(`目标: ${BASE_URL}\n`);

    // === 1. 健康检查 ===
    console.log('=== 1. 健康检查 ===');
    await testEndpoint('GET /api/health', '/api/health', 200, (data) => {
        assert(data.status === 'healthy' || data.status === 'degraded', 'health status');
        assert(data.startedAt !== undefined, 'health startedAt');
        assert(data.pid !== undefined, 'health pid');
    });

    // === 2. 配置状态 ===
    console.log('\n=== 2. 配置状态 ===');
    await testEndpoint('GET /api/settings/config-status', '/api/settings/config-status', 200, (data) => {
        assert(typeof data === 'object', 'config-status is object');
    });

    // === 3. 项目列表 ===
    console.log('\n=== 3. 项目列表 ===');
    await testEndpoint('GET /api/projects', '/api/projects', 200, (data) => {
        assert(Array.isArray(data), 'projects is array');
    });

    // === 4. 题材列表 ===
    console.log('\n=== 4. 题材列表 ===');
    await testEndpoint('GET /api/genre-debug/list', '/api/genre-debug/list', 200, (data) => {
        assert(data.success === true || Array.isArray(data.data), 'genre list success');
    });

    // === 5. Agent列表 ===
    console.log('\n=== 5. Agent列表 ===');
    await testEndpoint('GET /api/pipeline/agents', '/api/pipeline/agents', 200, (data) => {
        assert(typeof data === 'object', 'agents is object');
    });

    // === 6. Metrics端点 ===
    console.log('\n=== 6. Metrics端点 ===');
    await testEndpoint('GET /api/health/metrics', '/api/health/metrics', 200, (data) => {
        assert(typeof data === 'object', 'metrics is object');
    });

    // === 7. 安全头检查 ===
    console.log('\n=== 7. 安全头检查 ===');
    try {
        const res = await fetch('/api/health');
        const h = res.headers;
        assert(h['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options');
        assert(h['x-frame-options'] === 'DENY', 'X-Frame-Options');
        assert(h['x-xss-protection'] !== undefined, 'X-XSS-Protection');
        console.log(`  ✅ 安全头: X-Content-Type-Options=${h['x-content-type-options']}, X-Frame-Options=${h['x-frame-options']}`);
    } catch (e) {
        assert(false, `安全头: ${e.message}`);
        console.log(`  ❌ 安全头: ${e.message}`);
    }

    // === 8. 404处理 ===
    console.log('\n=== 8. 404处理 ===');
    await testEndpoint('GET /api/nonexistent', '/api/nonexistent', 404);

    // === Summary ===
    console.log('\n' + '='.repeat(50));
    console.log(`E2E API 测试结果: ${passed} passed, ${failed} failed`);
    if (errors.length > 0) {
        console.log('\n失败详情:');
        errors.forEach(e => console.log(`  ❌ ${e}`));
    }
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('E2E API test crashed:', e.message);
    process.exit(1);
});
