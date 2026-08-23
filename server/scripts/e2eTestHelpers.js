const http = require('http');
const { SERVER_DEFAULTS } = require('../config/systemConfig');

const BASE = `http://localhost:${process.env.PORT || SERVER_DEFAULTS.DEFAULT_PORT}`;
const TIMEOUT_MS = 15000;

function api(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { let parsed = null; try { parsed = JSON.parse(data); } catch (_) {} resolve({ status: res.statusCode, body: parsed, raw: data.substring(0, 500) }); });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const RESULTS = [];

async function test(name, fn) {
    const start = Date.now();
    try {
        const result = await fn();
        const ms = Date.now() - start;
        RESULTS.push({ name, passed: result.passed, ms, detail: result.detail || '' });
        console.log(`${result.passed ? '✅' : '❌'} ${name} (${ms}ms) ${result.detail || ''}`);
        return result.passed;
    } catch (e) {
        const ms = Date.now() - start;
        RESULTS.push({ name, passed: false, ms, detail: e.message });
        console.log(`❌ ${name} (${ms}ms) ERROR: ${e.message}`);
        return false;
    }
}

function printSummary() {
    console.log('\n' + '='.repeat(60));
    const passed = RESULTS.filter(r => r.passed).length;
    const failed = RESULTS.filter(r => !r.passed).length;
    console.log(`📊 结果: ${passed}/${RESULTS.length} 通过, ${failed} 失败`);
    if (failed > 0) { console.log('\n❌ 失败项:'); RESULTS.filter(r => !r.passed).forEach(r => console.log(`   - ${r.name}: ${r.detail}`)); }
    return { passed, failed, total: RESULTS.length, results: RESULTS };
}

module.exports = { api, test, RESULTS, printSummary };
