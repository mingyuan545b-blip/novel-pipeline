/**
 * 冒烟测试脚本 - 验证核心API可达性
 * 用法: node scripts/smoke-test.js [BASE_URL]
 * 默认: http://localhost:3001
 */
require('dotenv').config();
const http = require('http');
const https = require('https');
const { SERVER_DEFAULTS } = require('../config/systemConfig');

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || SERVER_DEFAULTS.DEFAULT_PORT}`;
const RESULTS = [];
const TIMEOUT_MS = 10000;

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const mod = url.protocol === 'https:' ? https : http;
        const opts = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: { 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS
        };
        const req = mod.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (_) { /* non-json */ }
                resolve({ status: res.statusCode, body: parsed, raw: data.substring(0, 500) });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test(name, fn) {
    const start = Date.now();
    try {
        const result = await fn();
        const ms = Date.now() - start;
        const passed = result.passed;
        RESULTS.push({ name, passed, ms, detail: result.detail || '' });
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${name} (${ms}ms) ${result.detail || ''}`);
        return passed;
    } catch (e) {
        const ms = Date.now() - start;
        RESULTS.push({ name, passed: false, ms, detail: e.message });
        console.log(`❌ ${name} (${ms}ms) ERROR: ${e.message}`);
        return false;
    }
}

async function run() {
    console.log(`\n🧪 冒烟测试 - ${BASE}`);
    console.log('='.repeat(60));

    // S1: 健康检查
    await test('S1: 健康检查 GET /api/health', async () => {
        const r = await request('GET', '/api/health');
        return { passed: r.status === 200, detail: `status=${r.status}` };
    });

    // S2: 配置状态
    await test('S2: 配置状态 GET /api/settings/config-status', async () => {
        const r = await request('GET', '/api/settings/config-status');
        const hasKeys = r.body?.apiKeyConfigured === true;
        return { passed: r.status === 200, detail: `status=${r.status} apiKeyConfigured=${r.body?.apiKeyConfigured}` };
    });

    // S3: 项目列表
    await test('S3: 项目列表 GET /api/projects', async () => {
        const r = await request('GET', '/api/projects');
        const isArray = Array.isArray(r.body);
        return { passed: r.status === 200 && isArray, detail: `status=${r.status} count=${isArray ? r.body.length : 'N/A'}` };
    });

    // S4: Agent列表
    await test('S4: Agent列表 GET /api/agents', async () => {
        const r = await request('GET', '/api/agents');
        const isArray = Array.isArray(r.body);
        return { passed: r.status === 200 && isArray, detail: `status=${r.status} count=${isArray ? r.body.length : 'N/A'}` };
    });

    // S5: 题材解析
    await test('S5: 题材解析 GET /api/genre-debug/list', async () => {
        const r = await request('GET', '/api/genre-debug/list');
        const hasGenres = Array.isArray(r.body) || (r.body && Object.keys(r.body).length > 0);
        return { passed: r.status === 200 && !!hasGenres, detail: `status=${r.status}` };
    });

    // S6: 素材类型
    await test('S6: 素材类型 GET /api/materials/types', async () => {
        const r = await request('GET', '/api/materials/types');
        const hasTypes = Array.isArray(r.body) || (r.body && typeof r.body === 'object');
        return { passed: r.status === 200 && !!hasTypes, detail: `status=${r.status}` };
    });

    // S7: Pipeline状态
    await test('S7: Pipeline状态 GET /api/pipeline/agents', async () => {
        const r = await request('GET', '/api/pipeline/agents');
        const isArray = Array.isArray(r.body);
        return { passed: r.status === 200 && isArray, detail: `status=${r.status} count=${isArray ? r.body.length : 'N/A'}` };
    });

    // S8: 实体中心
    await test('S8: 实体中心 GET /api/entity-center/registry', async () => {
        const r = await request('GET', '/api/entity-center/registry');
        return { passed: r.status === 200 || r.status === 404, detail: `status=${r.status}` };
    });

    // S9: 知识库
    await test('S9: 知识库 GET /api/knowledge/facts', async () => {
        const r = await request('GET', '/api/knowledge/facts');
        return { passed: r.status === 200 || r.status === 404, detail: `status=${r.status}` };
    });

    // S10: 约束预设
    await test('S10: 约束预设 GET /api/prompt-config/constraint-presets', async () => {
        const r = await request('GET', '/api/prompt-config/constraint-presets');
        return { passed: r.status === 200, detail: `status=${r.status}` };
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    const passed = RESULTS.filter(r => r.passed).length;
    const failed = RESULTS.filter(r => !r.passed).length;
    const total = RESULTS.length;
    console.log(`📊 结果: ${passed}/${total} 通过, ${failed} 失败`);

    if (failed > 0) {
        console.log('\n❌ 失败项:');
        RESULTS.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.name}: ${r.detail}`);
        });
    }

    // JSON report
    const report = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE,
        total, passed, failed,
        results: RESULTS
    };
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', 'test-reports', `smoke-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告: ${reportPath}`);

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(2);
});
