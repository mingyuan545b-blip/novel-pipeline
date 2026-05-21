const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PLATFORMS } = require('./platformConfig');
const { addLog, getRawState, ensureState } = require('./stateManager');

async function connectBrowser(platform, cdpUrl) {
    const s = ensureState(platform);

    if (s.context) {
        try {
            const existingPages = s.context.pages();
            if (existingPages.length > 0) {
                const testPage = existingPages[0];
                await testPage.evaluate(() => true).catch(() => null);
                addLog(platform, '复用现有浏览器连接...');
                s.page = existingPages[0];
                return s.page;
            }
        } catch (e) {
            addLog(platform, `现有浏览器已失效(${e.message?.substring(0, 60)})，重新连接...`);
        }
        try { await s.context.close(); } catch (e) { }
        s.context = null;
        s.browser = null;
    }

    if (cdpUrl) {
        addLog(platform, `通过CDP连接浏览器: ${cdpUrl}`);
        s.browser = await chromium.connectOverCDP(cdpUrl);
        const contexts = s.browser.contexts();
        s.context = contexts.length > 0 ? contexts[0] : await s.browser.newContext();
    } else {
        const userDataDir = path.join(__dirname, '..', '..', 'output', 'browser-data', platform);
        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        const useEdge = fs.existsSync(edgePath);
        const channel = useEdge ? 'msedge' : 'chrome';
        addLog(platform, `启动${useEdge ? 'Edge' : 'Chrome'}浏览器（持久化模式）...`);

        s.context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel,
            viewport: { width: 1280, height: 800 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check'
            ]
        });
    }

    const pages = s.context.pages();
    s.page = pages.length > 0 ? pages[0] : await s.context.newPage();
    return s.page;
}

async function checkLoginStatus(platform, page) {
    const cfg = PLATFORMS[platform];
    try {
        await page.goto(cfg.writerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        const currentUrl = page.url();
        addLog(platform, `登录检测URL: ${currentUrl}`);
        if (cfg.loginUrlKeywords.some(k => currentUrl.includes(k))) {
            addLog(platform, '检测到登录页面，需要登录');
            return { loggedIn: false, reason: '需要登录' };
        }
        const pageContent = await page.content();
        const foundIndicators = cfg.loginIndicators.filter(k => pageContent.includes(k));
        addLog(platform, `登录指标: ${foundIndicators.join(',') || '无'}`);

        const notLoggedInIndicators = ['请登录', '立即登录', '请先登录', '前往登录', '验证码登录', '扫码登录'];
        const isNotLoggedIn = notLoggedInIndicators.some(k => pageContent.includes(k));
        if (isNotLoggedIn) {
            addLog(platform, '检测到"请登录"提示，判定为未登录');
            return { loggedIn: false, reason: '需要登录' };
        }
        if (foundIndicators.length > 0) {
            return { loggedIn: true };
        }
        const hasEditorElements = (await page.locator('input, textarea, [contenteditable], button').count()) > 0;
        if (hasEditorElements) {
            return { loggedIn: true };
        }
        return { loggedIn: false, reason: '未检测到登录状态' };
    } catch (e) {
        return { loggedIn: false, reason: `检查登录失败: ${e.message}` };
    }
}

async function waitForLogin(platform, page, timeout = 600000) {
    addLog(platform, `等待用户登录${PLATFORMS[platform].name}（最长${Math.round(timeout/60000)}分钟）...`);
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const s = getRawState(platform);
        if (s?.stopped) return false;
        await page.waitForTimeout(5000);
        try {
            const currentUrl = page.url();
            if (currentUrl.includes('login') || currentUrl.includes('passport')) {
                continue;
            }
            const pageContent = await page.content();
            const notLoggedInIndicators = ['请登录', '立即登录', '请先登录', '前往登录', '验证码登录', '扫码登录'];
            if (notLoggedInIndicators.some(k => pageContent.includes(k))) {
                continue;
            }
            const foundIndicators = PLATFORMS[platform].loginIndicators.filter(k => pageContent.includes(k));
            if (foundIndicators.length > 0) {
                addLog(platform, '登录成功！');
                const s2 = ensureState(platform);
                s2.loginStatus = 'logged-in';
                return true;
            }
        } catch (e) {}
    }
    addLog(platform, '登录超时');
    const s3 = ensureState(platform);
    s3.loginStatus = 'timeout';
    return false;
}

async function ensureLogin(platform, page, maxWait = 600000) {
    const s = ensureState(platform);
    if (s.loginStatus === 'logged-in') {
        try {
            const currentUrl = page.url();
            if (!currentUrl.includes('login') && !currentUrl.includes('sign-in')) {
                const quickCheck = await page.evaluate(() => {
                    const body = document.body?.innerText?.substring(0, 300) || '';
                    const notLoggedIn = ['请登录', '立即登录', '请先登录', '前往登录', '验证码登录', '扫码登录'];
                    return !notLoggedIn.some(k => body.includes(k));
                }).catch(() => false);
                if (quickCheck) {
                    addLog(platform, '已登录状态确认，跳过登录检查');
                    return true;
                }
            }
        } catch (e) {}
    }

    const loginStatus = await checkLoginStatus(platform, page);
    if (loginStatus.loggedIn) {
        s.loginStatus = 'logged-in';
        return true;
    }
    addLog(platform, `未登录: ${loginStatus.reason}，请在新打开的浏览器中手动登录${PLATFORMS[platform].name}...`);
    s.loginStatus = 'waiting';
    const loggedIn = await waitForLogin(platform, page, maxWait);
    if (!loggedIn) {
        s.loginStatus = 'timeout';
        addLog(platform, '登录超时');
    }
    return loggedIn;
}

async function closeBrowser(platform) {
    const s = getRawState(platform);
    if (!s) return;
    try {
        if (s.context) {
            try { await s.context.close(); } catch (e) {}
        }
        if (s.browser) {
            try { await s.browser.close(); } catch (e) {}
        }
    } catch (e) {}
    s.browser = null; s.context = null; s.page = null;
    s.loginStatus = null;
    addLog(platform, '浏览器已关闭');
}

async function closeAllBrowsers() {
    const { publishStates } = require('./stateManager');
    for (const platform of Object.keys(publishStates)) {
        await closeBrowser(platform);
    }
}

module.exports = {
    connectBrowser,
    checkLoginStatus,
    waitForLogin,
    ensureLogin,
    closeBrowser,
    closeAllBrowsers
};
