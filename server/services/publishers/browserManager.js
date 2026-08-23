const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('../../shared/logger');
const { publishStates, addLog } = require('./platformConfig');

async function takeScreenshot(page, platform, label) {
    try {
        const screenshotDir = path.join(__dirname, '..', '..', 'output', 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, `${platform}-${label}-${Date.now()}.png`), fullPage: true });
    } catch (e) {
        logger.debug('PublisherBase', 'Failed to take screenshot', { error: e.message });
    }
}

async function connectBrowser(platform, cdpUrl) {
    const s = publishStates[platform];

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
        try { await s.context.close(); } catch (e) {
            logger.debug('PublisherBase', 'Failed to close context during reconnect', { error: e.message });
        }
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

async function closeBrowser(platform) {
    const s = publishStates[platform];
    if (s) {
        try { if (s.context) await s.context.close(); } catch (e) {
            logger.debug('PublisherBase', 'Failed to close context', { error: e.message });
        }
        try { if (s.browser) await s.browser.close(); } catch (e) {
            logger.debug('PublisherBase', 'Failed to close browser', { error: e.message });
        }
        s.browser = null; s.context = null; s.page = null;
        s.loginStatus = null;
        addLog(platform, '浏览器已关闭');
    }
}

async function closeAllBrowsers() {
    for (const platform of Object.keys(publishStates)) {
        await closeBrowser(platform);
    }
}

module.exports = {
    takeScreenshot,
    connectBrowser,
    closeBrowser,
    closeAllBrowsers
};
