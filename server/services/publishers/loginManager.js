const logger = require('../../shared/logger');
const { PLATFORMS, publishStates, addLog } = require('./platformConfig');

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
        if (publishStates[platform].stopped) return false;
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
                publishStates[platform].loginStatus = 'logged-in';
                return true;
            }
        } catch (e) {
            logger.debug('PublisherBase', 'Login polling check failed', { error: e.message });
        }
    }
    addLog(platform, '登录超时');
    publishStates[platform].loginStatus = 'timeout';
    return false;
}

async function ensureLogin(platform, page, maxWait = 600000) {
    if (publishStates[platform].loginStatus === 'logged-in') {
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
        } catch (e) {
            logger.debug('PublisherBase', 'Quick login check failed', { error: e.message });
        }
    }

    const loginStatus = await checkLoginStatus(platform, page);
    if (loginStatus.loggedIn) {
        publishStates[platform].loginStatus = 'logged-in';
        return true;
    }
    addLog(platform, `未登录: ${loginStatus.reason}，请在新打开的浏览器中手动登录${PLATFORMS[platform].name}...`);
    publishStates[platform].loginStatus = 'waiting';
    const loggedIn = await waitForLogin(platform, page, maxWait);
    if (!loggedIn) {
        publishStates[platform].loginStatus = 'timeout';
        addLog(platform, '登录超时');
    }
    return loggedIn;
}

module.exports = {
    checkLoginStatus,
    waitForLogin,
    ensureLogin
};
