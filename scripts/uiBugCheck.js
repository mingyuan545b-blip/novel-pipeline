'use strict';

/**
 * uiBugCheck.js — 前端UI自动化巡检
 *
 * 逐页访问所有路由，捕获：
 *   - console.error（前端报错）
 *   - pageerror（未捕获异常）
 *   - 400+/网络失败的API请求（后端问题定位）
 *   - 页面可见错误文本（错误边界/警告条）
 * 每页截图 + 生成 output/ui-bugcheck/report.json
 *
 * 前提: 后端3001 + 前端5173 已启动（桌面"小说流水线-启动"按钮）
 * 用法: node scripts/uiBugCheck.js
 */
const path = require('path');
const fs = require('fs');
const PROJECT_ROOT = path.join(__dirname, '..');
const { chromium } = require(path.join(PROJECT_ROOT, 'client', 'node_modules', 'playwright'));

const BASE = 'http://localhost:5173';
const ROUTES = [
    '/', '/pipeline', '/materials', '/chapters', '/agents', '/settings',
    '/guide', '/workshop', '/publish', '/knowledge', '/library',
    '/entity-center', '/style-templates', '/context-assembly', '/metrics',
    '/genre-debug', '/debug-logs',
    '/comic/config', '/comic/workflows', '/comic/storyboard', '/comic/render', '/comic/export'
];

function shotName(route) {
    return (route === '/' ? 'home' : route.slice(1).replace(/\//g, '-')) + '.png';
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push({ route: page.url(), text: msg.text().slice(0, 300) });
    });
    page.on('pageerror', err => {
        pageErrors.push({ route: page.url(), message: String(err && err.message || err).slice(0, 300) });
    });
    page.on('response', resp => {
        if (resp.status() >= 400 && resp.url().includes(':3001')) {
            failedRequests.push({ route: page.url(), api: resp.url(), status: resp.status() });
        }
    });
    page.on('requestfailed', req => {
        if (req.url().includes(':3001')) {
            const failure = req.failure();
            failedRequests.push({ route: page.url(), api: req.url(), status: 'NETWORK_FAIL', errorText: failure ? failure.errorText : '' });
        }
    });

    const shotDir = path.join(PROJECT_ROOT, 'output', 'ui-bugcheck');
    fs.mkdirSync(shotDir, { recursive: true });

    const report = { at: new Date().toISOString(), pages: [] };

    for (const route of ROUTES) {
        const ce = consoleErrors.length, pe = pageErrors.length, fr = failedRequests.length;
        const entry = { route };
        try {
            const resp = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
            entry.httpStatus = resp ? resp.status() : null;
            await page.waitForTimeout(2000); // 等异步数据加载
            entry.visibleError = await page.evaluate(() => {
                const sels = '[role="alert"], .error-boundary, .error-message, .ant-result-error';
                const el = document.querySelector(sels);
                return el ? (el.innerText || '').slice(0, 200) : null;
            }).catch(() => null);
            entry.bodyHasErrorText = await page.evaluate(() => {
                const t = document.body ? document.body.innerText : '';
                return /出错了|加载失败|Error Boundary|系统错误/.test(t);
            }).catch(() => false);
            entry.screenshot = 'output/ui-bugcheck/' + shotName(route);
            await page.screenshot({ path: path.join(shotDir, shotName(route)) });
        } catch (e) {
            entry.gotoError = String(e.message || e).slice(0, 200);
        }
        entry.consoleErrors = consoleErrors.slice(ce).map(e => e.text);
        entry.pageErrors = pageErrors.slice(pe).map(e => e.message);
        entry.failedRequests = failedRequests.slice(fr);
        entry.issueCount = entry.consoleErrors.length + entry.pageErrors.length + entry.failedRequests.length;
        report.pages.push(entry);
        const flag = entry.gotoError ? 'X' : (entry.issueCount > 0 ? '!' : 'V');
        console.log('[' + flag + '] ' + route + ' 问题数:' + entry.issueCount + (entry.gotoError ? ' 导航失败:' + entry.gotoError : ''));
    }

    await browser.close();
    fs.writeFileSync(path.join(shotDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

    // 汇总
    const totalIssues = report.pages.reduce((s, p) => s + p.issueCount, 0);
    const apiFails = report.pages.flatMap(p => p.failedRequests);
    const apiByPath = {};
    for (const f of apiFails) {
        let key = f.api;
        try { key = new URL(f.api).pathname; } catch (e) { /* keep */ }
        key = key + ' [' + f.status + ']';
        apiByPath[key] = (apiByPath[key] || 0) + 1;
    }
    console.log('\n===== 汇总 =====');
    console.log('页面数: ' + report.pages.length + ' | 问题总数: ' + totalIssues);
    console.log('失败API(去重):');
    for (const [k, v] of Object.entries(apiByPath)) console.log('  ' + v + 'x ' + k);
    const pageErrs = [...new Set(report.pages.flatMap(p => p.pageErrors))];
    if (pageErrs.length) { console.log('未捕获异常:'); pageErrs.forEach(e => console.log('  - ' + e)); }
    console.log('\n完整报告: output/ui-bugcheck/report.json');
}

main().catch(e => { console.error('巡检失败: ' + (e.message || e)); process.exit(1); });
