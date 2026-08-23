/**
 * 深度交互测试 - 精确匹配每个页面的实际DOM结构
 * 排除503(ComfyUI未运行)和429(限流)等预期错误
 * 只关注真正的JS运行时错误和UI渲染bug
 */
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const results = { pages: [], jsErrors: [], uiBugs: [] };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testPage(browser, url, pageName) {
    const page = await browser.newPage();
    const jsErrors = [];
    const networkErrors = [];
    let realErrors = [];

    page.on('pageerror', err => {
        jsErrors.push(err.message);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // 排除预期的503(ComfyUI未运行)和429(限流)错误
            if (text.includes('503') || text.includes('429') || text.includes('ComfyUI')) return;
            // 排除网络资源加载失败（通常是外部服务不可用）
            if (text.includes('Failed to load resource') && !text.includes('localhost')) return;
            realErrors.push(text);
        }
    });

    const pageResult = { name: pageName, loaded: false, buttons: 0, tabs: 0, toggles: 0, inputs: 0, errors: [] };

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
        await sleep(2000);
        pageResult.loaded = true;

        // 统计交互控件
        pageResult.buttons = await page.$$eval('button', els => els.filter(e => !e.disabled).length).catch(() => 0);
        pageResult.tabs = await page.$$eval('[role="tab"], .tab-btn, .nav-tab, button[class*="tab"]', els => els.length).catch(() => 0);
        pageResult.toggles = await page.$$eval('input[type="checkbox"], [role="switch"], .toggle, .switch', els => els.length).catch(() => 0);
        pageResult.inputs = await page.$$eval('input:not([type="hidden"]), select, textarea', els => els.length).catch(() => 0);

        // 点击所有标签页
        const tabSelectors = [
            '[role="tab"]', '.tab-btn', 'button[class*="tab"]',
            '.nav-item', '.ant-tabs-tab', '[class*="Tab"]', '[class*="tab-"]'
        ];
        for (const sel of tabSelectors) {
            const tabs = await page.$$(sel);
            for (const tab of tabs) {
                try {
                    const text = await tab.evaluate(el => el.textContent?.trim()?.slice(0, 40) || '');
                    if (!text) continue;
                    await tab.click({ timeout: 3000 });
                    await sleep(800);
                } catch (_) {}
            }
        }

        // 点击所有开关
        const toggleSelectors = [
            'input[type="checkbox"]', '[role="switch"]', '.toggle', '.switch',
            'button[class*="toggle"]', 'button[class*="switch"]'
        ];
        for (const sel of toggleSelectors) {
            const toggles = await page.$$(sel);
            for (const toggle of toggles) {
                try {
                    await toggle.click({ timeout: 3000 });
                    await sleep(500);
                } catch (_) {}
            }
        }

        // 逐个点击按钮（限制前20个，避免限流）
        const buttons = await page.$$('button:not([disabled])');
        const maxButtons = Math.min(buttons.length, 20);
        for (let i = 0; i < maxButtons; i++) {
            try {
                const text = await buttons[i].evaluate(el => el.textContent?.trim()?.slice(0, 40) || '');
                if (!text || text.includes('删除') || text.includes('重置') || text.includes('清空')) continue; // 跳过危险操作
                await buttons[i].click({ timeout: 3000 });
                await sleep(600);
            } catch (_) {}
        }

        // 检查是否有白屏/空内容
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '');
        if (!bodyText || bodyText.length < 10) {
            pageResult.errors.push('页面内容为空或白屏');
        }

        // 检查是否有React错误边界
        const errorBoundary = await page.$$('.error-boundary, [class*="error-boundary"], [class*="ErrorBoundary"]');
        if (errorBoundary.length > 0) {
            pageResult.errors.push('检测到React错误边界');
        }

    } catch (err) {
        pageResult.errors.push(`加载失败: ${err.message?.slice(0, 100)}`);
    }

    // 只保留真正的JS错误（排除503/429）
    if (jsErrors.length > 0) {
        pageResult.errors.push(...jsErrors.map(e => `JS Error: ${e?.slice(0, 120)}`));
    }
    if (realErrors.length > 0) {
        pageResult.errors.push(...realErrors.map(e => `Console Error: ${e?.slice(0, 120)}`));
    }

    results.pages.push(pageResult);
    await page.close();
    return pageResult;
}

async function main() {
    console.log('=== 深度浏览器交互测试 ===\n');
    console.log('说明: 503(ComfyUI未运行)和429(限流)错误已自动排除\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const pages = [
        ['/', 'Dashboard'],
        ['/pipeline', 'Pipeline'],
        ['/materials', 'Materials'],
        ['/chapters', 'Chapters'],
        ['/agents', 'Agents'],
        ['/settings', 'Settings'],
        ['/knowledge', 'Knowledge'],
        ['/publish', 'Publish'],
        ['/genre-debug', 'GenreDebug'],
        ['/workshop', 'Workshop'],
        ['/entity-center', 'EntityCenter'],
        ['/library', 'Library'],
        ['/timeline', 'Timeline'],
        ['/map', 'Map'],
        ['/style-templates', 'StyleTemplates'],
        ['/guide', 'Guide'],
        ['/comic/config', 'ComicConfig'],
        ['/comic/workflows', 'ComicWorkflows'],
        ['/comic/storyboard', 'ComicStoryboard'],
        ['/comic/export', 'ComicExport'],
        ['/comic/render', 'ComicRender'],
        ['/character-states', 'CharacterStates'],
    ];

    for (const [path, name] of pages) {
        const r = await testPage(browser, `${BASE_URL}${path}`, name);
        const status = r.loaded && r.errors.length === 0 ? 'PASS' : 'FAIL';
        const icon = status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${name} | 加载:${r.loaded ? 'OK' : 'FAIL'} | 按钮:${r.buttons} | 标签:${r.tabs} | 开关:${r.toggles} | 输入:${r.inputs} | 错误:${r.errors.length}`);
        if (r.errors.length > 0) {
            for (const e of r.errors) console.log(`   → ${e}`);
        }
    }

    await browser.close();

    // 汇总
    const passed = results.pages.filter(p => p.loaded && p.errors.length === 0).length;
    const failed = results.pages.filter(p => !p.loaded || p.errors.length > 0).length;
    console.log(`\n=== 汇总 ===`);
    console.log(`通过: ${passed}/${results.pages.length}`);
    console.log(`失败: ${failed}/${results.pages.length}`);

    if (failed > 0) {
        console.log('\n--- 失败页面 ---');
        for (const p of results.pages.filter(p => !p.loaded || p.errors.length > 0)) {
            console.log(`❌ ${p.name}:`);
            for (const e of p.errors) console.log(`   ${e}`);
        }
    }
}

main().catch(err => {
    console.error('测试异常:', err.message);
    process.exit(1);
});
