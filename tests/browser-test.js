/**
 * 全面浏览器自动化测试脚本
 * 测试每个页面的加载、按钮点击、开关切换、子模块展开
 * 收集控制台错误和页面异常
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const results = { passed: [], failed: [], errors: [] };

function log(section, status, message) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️';
    console.log(`${icon} [${section}] ${message}`);
    if (status === 'PASS') results.passed.push(`${section}: ${message}`);
    else if (status === 'FAIL') results.failed.push(`${section}: ${message}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testPage(browser, url, pageName, testFn) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
        await sleep(1500);
        log(pageName, 'PASS', `页面加载成功`);

        if (testFn) await testFn(page, pageName);

        if (consoleErrors.length > 0) {
            log(pageName, 'FAIL', `控制台错误(${consoleErrors.length}): ${consoleErrors[0]?.slice(0, 120)}`);
            results.errors.push({ page: pageName, errors: consoleErrors.slice(0, 3) });
        } else {
            log(pageName, 'PASS', `无控制台错误`);
        }

        if (pageErrors.length > 0) {
            log(pageName, 'FAIL', `页面异常(${pageErrors.length}): ${pageErrors[0]?.slice(0, 120)}`);
            results.errors.push({ page: pageName, pageErrors: pageErrors.slice(0, 3) });
        }
    } catch (err) {
        log(pageName, 'FAIL', `加载失败: ${err.message?.slice(0, 120)}`);
    } finally {
        await page.close();
    }
}

async function clickAllButtons(page, pageName) {
    try {
        const buttons = await page.$$('button');
        let clicked = 0;
        for (const btn of buttons) {
            try {
                const text = await btn.evaluate(el => el.textContent?.trim()?.slice(0, 30) || '');
                const disabled = await btn.evaluate(el => el.disabled);
                if (disabled || !text) continue;
                await btn.click({ timeout: 2000 });
                clicked++;
                await sleep(300);
            } catch (_) { /* click failed, skip */ }
        }
        log(pageName, 'PASS', `点击了${clicked}个按钮`);
    } catch (err) {
        log(pageName, 'INFO', `按钮点击测试跳过: ${err.message?.slice(0, 60)}`);
    }
}

async function clickAllToggles(page, pageName) {
    try {
        const toggles = await page.$$('[role="switch"], input[type="checkbox"], .toggle, .switch');
        let clicked = 0;
        for (const toggle of toggles) {
            try {
                await toggle.click({ timeout: 2000 });
                clicked++;
                await sleep(300);
            } catch (_) { /* click failed, skip */ }
        }
        if (clicked > 0) log(pageName, 'PASS', `切换了${clicked}个开关`);
        else log(pageName, 'INFO', `无开关控件`);
    } catch (err) {
        log(pageName, 'INFO', `开关测试跳过`);
    }
}

async function clickAllTabs(page, pageName) {
    try {
        const tabs = await page.$$('[role="tab"], .tab, .nav-item, .ant-tabs-tab');
        let clicked = 0;
        for (const tab of tabs) {
            try {
                const text = await tab.evaluate(el => el.textContent?.trim()?.slice(0, 30) || '');
                if (!text) continue;
                await tab.click({ timeout: 2000 });
                clicked++;
                await sleep(500);
            } catch (_) { /* click failed, skip */ }
        }
        if (clicked > 0) log(pageName, 'PASS', `切换了${clicked}个标签页`);
        else log(pageName, 'INFO', `无标签页控件`);
    } catch (err) {
        log(pageName, 'INFO', `标签页测试跳过`);
    }
}

async function clickAllLinks(page, pageName) {
    try {
        const links = await page.$$('a[href]');
        let clicked = 0;
        for (const link of links) {
            try {
                const href = await link.evaluate(el => el.getAttribute('href'));
                if (!href || href.startsWith('#') || href.startsWith('http')) continue;
                await link.click({ timeout: 2000 });
                clicked++;
                await sleep(300);
                await page.goBack({ timeout: 3000 }).catch(() => {});
                await sleep(500);
            } catch (_) { /* click failed, skip */ }
        }
        if (clicked > 0) log(pageName, 'PASS', `点击了${clicked}个链接`);
    } catch (err) {
        log(pageName, 'INFO', `链接测试跳过`);
    }
}

async function clickAllSelects(page, pageName) {
    try {
        const selects = await page.$$('select');
        let clicked = 0;
        for (const sel of selects) {
            try {
                const options = await sel.$$('option');
                if (options.length > 1) {
                    await options[1].click();
                    clicked++;
                    await sleep(300);
                }
            } catch (_) { /* click failed, skip */ }
        }
        if (clicked > 0) log(pageName, 'PASS', `切换了${clicked}个下拉选择`);
    } catch (err) {
        log(pageName, 'INFO', `下拉选择测试跳过`);
    }
}

async function expandAllDetails(page, pageName) {
    try {
        const details = await page.$$('details summary, .accordion-header, .collapse-header, .expand-btn');
        let clicked = 0;
        for (const d of details) {
            try {
                await d.click({ timeout: 2000 });
                clicked++;
                await sleep(300);
            } catch (_) { /* click failed, skip */ }
        }
        if (clicked > 0) log(pageName, 'PASS', `展开了${clicked}个折叠面板`);
    } catch (err) {
        log(pageName, 'INFO', `折叠面板测试跳过`);
    }
}

async function fullInteractionTest(page, pageName) {
    await clickAllTabs(page, pageName);
    await clickAllToggles(page, pageName);
    await clickAllButtons(page, pageName);
    await clickAllSelects(page, pageName);
    await expandAllDetails(page, pageName);
}

async function main() {
    console.log('=== 启动浏览器自动化测试 ===\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        // === 1. Dashboard ===
        console.log('\n--- Dashboard ---');
        await testPage(browser, `${BASE_URL}/`, 'Dashboard', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 2. Pipeline ===
        console.log('\n--- Pipeline ---');
        await testPage(browser, `${BASE_URL}/pipeline`, 'Pipeline', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 3. Materials ===
        console.log('\n--- Materials ---');
        await testPage(browser, `${BASE_URL}/materials`, 'Materials', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 4. Chapters ===
        console.log('\n--- Chapters ---');
        await testPage(browser, `${BASE_URL}/chapters`, 'Chapters', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 5. Agents ===
        console.log('\n--- Agents ---');
        await testPage(browser, `${BASE_URL}/agents`, 'Agents', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 6. Settings ===
        console.log('\n--- Settings ---');
        await testPage(browser, `${BASE_URL}/settings`, 'Settings', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 7. Knowledge ===
        console.log('\n--- Knowledge ---');
        await testPage(browser, `${BASE_URL}/knowledge`, 'Knowledge', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 8. Publish ===
        console.log('\n--- Publish ---');
        await testPage(browser, `${BASE_URL}/publish`, 'Publish', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 9. GenreDebug ===
        console.log('\n--- GenreDebug ---');
        await testPage(browser, `${BASE_URL}/genre-debug`, 'GenreDebug', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 10. Workshop ===
        console.log('\n--- Workshop ---');
        await testPage(browser, `${BASE_URL}/workshop`, 'Workshop', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 11. EntityCenter ===
        console.log('\n--- EntityCenter ---');
        await testPage(browser, `${BASE_URL}/entity-center`, 'EntityCenter', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 12. Library ===
        console.log('\n--- Library ---');
        await testPage(browser, `${BASE_URL}/library`, 'Library', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 13. Timeline ===
        console.log('\n--- Timeline ---');
        await testPage(browser, `${BASE_URL}/timeline`, 'Timeline', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 14. Map ===
        console.log('\n--- Map ---');
        await testPage(browser, `${BASE_URL}/map`, 'Map', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 15. StyleTemplates ===
        console.log('\n--- StyleTemplates ---');
        await testPage(browser, `${BASE_URL}/style-templates`, 'StyleTemplates', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 16. Guide ===
        console.log('\n--- Guide ---');
        await testPage(browser, `${BASE_URL}/guide`, 'Guide', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 17. Comic Config ===
        console.log('\n--- ComicConfig ---');
        await testPage(browser, `${BASE_URL}/comic/config`, 'ComicConfig', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 18. Comic Workflows ===
        console.log('\n--- ComicWorkflows ---');
        await testPage(browser, `${BASE_URL}/comic/workflows`, 'ComicWorkflows', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 19. Comic Storyboard ===
        console.log('\n--- ComicStoryboard ---');
        await testPage(browser, `${BASE_URL}/comic/storyboard`, 'ComicStoryboard', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 20. Comic Export ===
        console.log('\n--- ComicExport ---');
        await testPage(browser, `${BASE_URL}/comic/export`, 'ComicExport', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 21. Comic Render ===
        console.log('\n--- ComicRender ---');
        await testPage(browser, `${BASE_URL}/comic/render`, 'ComicRender', async (page, name) => {
            await fullInteractionTest(page, name);
        });

        // === 22. CharacterStates (redirects to entity-center) ===
        console.log('\n--- CharacterStates ---');
        await testPage(browser, `${BASE_URL}/character-states`, 'CharacterStates', async (page, name) => {
            await fullInteractionTest(page, name);
        });

    } finally {
        await browser.close();
    }

    // === 汇总 ===
    console.log('\n\n========== 测试汇总 ==========');
    console.log(`PASS: ${results.passed.length}`);
    console.log(`FAIL: ${results.failed.length}`);
    if (results.failed.length > 0) {
        console.log('\n--- 失败项 ---');
        for (const f of results.failed) console.log(`  ❌ ${f}`);
    }
    if (results.errors.length > 0) {
        console.log('\n--- 错误详情 ---');
        for (const e of results.errors) {
            console.log(`  [${e.page}]`);
            if (e.errors) e.errors.forEach(err => console.log(`    Console: ${err?.slice(0, 150)}`));
            if (e.pageErrors) e.pageErrors.forEach(err => console.log(`    PageError: ${err?.slice(0, 150)}`));
        }
    }
    console.log('\n================================');
}

main().catch(err => {
    console.error('测试脚本异常:', err.message);
    process.exit(1);
});
