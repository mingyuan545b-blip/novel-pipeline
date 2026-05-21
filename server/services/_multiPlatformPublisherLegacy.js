const { chromium } = require('playwright');
const store = require('../store');
const { cleanChapterContent } = require('./contentUtils');
const { scanContent: scanSensitiveWords } = require('./sensitiveWordGuard');
const path = require('path');
const fs = require('fs');

const PLATFORMS = {
    fanqie: {
        name: '番茄小说',
        writerUrl: 'https://fanqienovel.com/main/writer/book-manage',
        loginIndicators: ['工作台', '作品管理', '我的作品', '码字日历', '章节管理', '创建章节', '创建作品', '新建章节'],
        loginUrlKeywords: ['login', 'passport'],
        minWordCount: 1000
    },
    qimao: {
        name: '七猫小说',
        writerUrl: 'https://zuozhe.qimao.com',
        loginIndicators: ['作家中心', '作品管理', '我的作品', '创作中心', '章节管理'],
        loginUrlKeywords: ['login', 'passport', 'sign-in'],
        minWordCount: 1000
    },
    douyin: {
        name: '抖音小说',
        writerUrl: 'https://creator.douyin.com/creator-micro/content/publish',
        loginIndicators: ['创作服务平台', '创作者中心', '发布作品'],
        loginUrlKeywords: ['login', 'passport', 'sso'],
        minWordCount: 1000
    },
    zhangyue: {
        name: '掌阅 iReader',
        writerUrl: 'https://writer.zhangyue.com',
        loginIndicators: ['作者中心', '作品管理', '我的作品'],
        loginUrlKeywords: ['login', 'passport', 'auth'],
        minWordCount: 1000
    },
    shuqi: {
        name: '书旗小说',
        writerUrl: 'https://writer.shuqi.com',
        loginIndicators: ['作者中心', '作品管理', '我的作品', '创作中心'],
        loginUrlKeywords: ['login', 'passport', 'auth'],
        minWordCount: 1000
    }
};

const publishStates = {};

function getPlatformState(platform) {
    if (!publishStates[platform]) {
        publishStates[platform] = {
            running: false, logs: [], currentChapter: null,
            totalChapters: 0, completedChapters: 0, failedChapters: 0,
            browser: null, context: null, page: null, stopped: false,
            loginStatus: null
        };
    }
    const s = publishStates[platform];
    return {
        running: s.running, currentChapter: s.currentChapter,
        totalChapters: s.totalChapters, completedChapters: s.completedChapters,
        failedChapters: s.failedChapters, stopped: s.stopped,
        loginStatus: s.loginStatus,
        logs: s.logs.slice(-100)
    };
}

function getAllStates() {
    const result = {};
    for (const platform of Object.keys(PLATFORMS)) {
        result[platform] = getPlatformState(platform);
    }
    return result;
}

function addLog(platform, msg) {
    if (!publishStates[platform]) publishStates[platform] = { running: false, logs: [], stopped: false, completedChapters: 0, failedChapters: 0, totalChapters: 0, currentChapter: null, loginStatus: null };
    const s = publishStates[platform];
    const time = new Date().toISOString();
    s.logs.push({ time, msg });
    console.log(`[${platform.toUpperCase()}-PUBLISH] ${msg}`);
    if (s.logs.length > 500) s.logs = s.logs.slice(-300);
}

async function takeScreenshot(page, platform, label) {
    try {
        const screenshotDir = path.join(__dirname, '..', 'output', 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: path.join(screenshotDir, `${platform}-${label}-${Date.now()}.png`), fullPage: true });
    } catch (e) {}
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
        const userDataDir = path.join(__dirname, '..', 'output', 'browser-data', platform);
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
        } catch (e) {}
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
        } catch (e) {}
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

async function dismissEditorGuides(page, platform) {
    const maxRounds = 8;
    for (let round = 1; round <= maxRounds; round++) {
        const guide = page.locator('.reactour__helper, .publish-guide, [role="dialog"], .arco-modal, .byte-modal').last();
        if (!await guide.count()) break;
        const text = ((await guide.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        let handled = false;
        const labels = ['知道了', '我知道了', '下一步', '完成', '跳过', '关闭'];
        for (const label of labels) {
            const btn = guide.locator('button, div, span').filter({ hasText: label }).first();
            if (await btn.count()) {
                await btn.click({ timeout: 3000 }).catch(async () => btn.click({ timeout: 3000, force: true }));
                handled = true;
                await page.waitForTimeout(800);
                break;
            }
        }
        if (!handled) {
            const closeBtn = guide.locator('[aria-label="Close"], .reactour__close-button, .arco-modal-close-icon, .byte-modal-close-icon').first();
            if (await closeBtn.count()) {
                await closeBtn.click({ timeout: 3000 }).catch(async () => closeBtn.click({ timeout: 3000, force: true }));
                handled = true;
                await page.waitForTimeout(800);
            }
        }
        if (!handled && /\d+\s*\/\s*\d+/.test(text)) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(500);
            handled = true;
        }
        if (!handled) break;
    }
}

async function handleInterceptors(page, platform) {
    const maxRounds = 10;
    for (let round = 1; round <= maxRounds; round++) {
        const publishModal = page.locator('.arco-modal.publish-confirm-container-new').last();
        if (await publishModal.count()) return 'publish-modal';

        const dialog = page.locator('.arco-modal[role="dialog"], .byte-modal[role="dialog"], .reactour__helper[role="dialog"], .reactour__helper, .arco-modal, .byte-modal').last();
        if (await dialog.count()) {
            const text = ((await dialog.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();

            const isSpellcheck = /错别字|智能纠错|是否确定提交|发布提示|敏感词|替换全部|忽略全部/.test(text);
            const isRiskDetection = /是否进行内容风险检测|风险检测/.test(text);
            const isGuide = /知道了|我知道了|下一步|跳过|完成|欢迎|引导|卡文锦囊|AI帮你/.test(text);

            let candidates = [];
            if (isSpellcheck) {
                candidates = ['忽略全部', '替换全部', '全部替换', '确认替换', '提交'];
            } else if (isRiskDetection) {
                candidates = ['确定'];
            } else if (isGuide) {
                candidates = ['我知道了', '知道了', '下一步', '完成', '跳过', '关闭'];
            }

            let handled = false;
            for (const label of candidates) {
                const btn = dialog.locator('button').filter({ hasText: label }).first();
                if (await btn.count()) {
                    addLog(platform, `处理拦路弹窗 round${round}: [${label}] ${text.slice(0, 80)}`);
                    await btn.click().catch(async () => btn.click({ force: true }));
                    await page.waitForTimeout(1800);
                    handled = true;
                    break;
                }
            }

            const publishModal2 = page.locator('.arco-modal.publish-confirm-container-new').last();
            if (await publishModal2.count()) return 'publish-modal';

            const anyDialog = page.locator('.arco-modal[role="dialog"], .byte-modal[role="dialog"], .reactour__helper[role="dialog"], .reactour__helper, .arco-modal, .byte-modal').last();
            if (!(await anyDialog.count())) continue;

            if (!handled && isGuide) {
                const closeBtn = anyDialog.locator('[aria-label="Close"], .reactour__close-button, .arco-modal-close-icon, .byte-modal-close-icon').first();
                if (await closeBtn.count()) {
                    await closeBtn.click().catch(async () => closeBtn.click({ force: true }));
                    await page.waitForTimeout(1500);
                    continue;
                }
            }

            if (!handled && isSpellcheck) {
                addLog(platform, `敏感词/错别字弹窗未处理，尝试Escape关闭...`);
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(1500);
                continue;
            }

            if (!handled && isRiskDetection) {
                return 'blocked:risk-detection';
            }

            if (!handled && !isGuide) {
                return 'blocked:unknown-dialog';
            }
        }
        await page.waitForTimeout(1200);
    }
    return 'unknown';
}

async function debugPageInputs(page, platform) {
    const inputInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(el => ({
            tag: el.tagName,
            type: el.type,
            placeholder: el.placeholder || '',
            name: el.name || '',
            className: el.className || '',
            id: el.id || '',
            value: el.value || '',
            visible: el.offsetWidth > 0 && el.offsetHeight > 0,
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || ''
        }));
    });
    addLog(platform, `页面input元素(${inputInfo.length}个): ${JSON.stringify(inputInfo.slice(0, 20))}`);
    return inputInfo;
}

async function fillSerialInput(page, platform, chapterNum) {
    addLog(platform, `填写章节序号(纯阿拉伯数字): ${chapterNum}`);

    const selectors = [
        '.serial-editor-title-left .left-input input.serial-input',
        '.serial-editor-title-left input.serial-input',
        '.left-input input.serial-input',
    ];

    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            const ph = await loc.getAttribute('placeholder').catch(() => '');
            if (ph && ph.includes('标题')) {
                addLog(platform, `跳过选择器 ${sel} (匹配到了标题框)`);
                continue;
            }

            addLog(platform, `找到序号框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterNum, { delay: 80 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `序号框填入后值: 期望=${chapterNum} 实际=${val}`);
            if (val === chapterNum) {
                addLog(platform, `章节序号已填: ${chapterNum}`);
                return true;
            }

            addLog(platform, `fill()值不匹配，尝试JS直接设值+触发事件...`);
            await loc.evaluate((el, num) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, num);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterNum);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            addLog(platform, `JS设值后: 期望=${chapterNum} 实际=${val2}`);
            if (val2 === chapterNum) {
                addLog(platform, `章节序号已填(JS): ${chapterNum}`);
                return true;
            }
        }
    }

    addLog(platform, '选择器全部未匹配，用JS按DOM结构精确定位+键盘输入...');
    const found = await page.evaluate(() => {
        const leftInput = document.querySelector('.serial-editor-title-left .left-input');
        if (leftInput) return !!leftInput.querySelector('input');
        const allInputs = Array.from(document.querySelectorAll('input.serial-input'));
        const serialInput = allInputs.find(el => !el.placeholder || el.placeholder === '');
        return !!serialInput;
    });

    if (found) {
        const jsSel = '.serial-editor-title-left .left-input input, input.serial-input:not([placeholder])';
        const loc = page.locator(jsSel).first();
        if (await loc.count()) {
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterNum, { delay: 80 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `JS定位+键盘输入后: 期望=${chapterNum} 实际=${val}`);
            if (val === chapterNum) return true;
        }
    }

    addLog(platform, `章节序号未能填入！`);
    return false;
}

async function fillTitleInput(page, platform, chapterTitle) {
    addLog(platform, `填写标题(不含"第X章"): ${chapterTitle}`);

    const selectors = [
        '.serial-editor-title-right .serial-editor-input-hint input[placeholder="请输入标题"]',
        '.serial-editor-title-right input[placeholder="请输入标题"]',
        'input.serial-input.serial-editor-input-hint-area[placeholder="请输入标题"]',
        'input[placeholder="请输入标题"]',
    ];

    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            addLog(platform, `找到标题框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterTitle, { delay: 50 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `标题框填入后值: 期望=${chapterTitle} 实际=${val}`);
            if (val === chapterTitle) {
                addLog(platform, `标题已填: ${chapterTitle}`);
                return true;
            }

            addLog(platform, `键盘输入值不匹配，尝试JS直接设值...`);
            await loc.evaluate((el, title) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, title);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterTitle);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            if (val2 === chapterTitle) {
                addLog(platform, `标题已填(JS): ${chapterTitle}`);
                return true;
            }
        }
    }

    addLog(platform, `标题未能填入！`);
    return false;
}

async function publishChapterToFanqie(page, chapter, bookId, fillOnly, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写番茄作品ID');
    }

    let rawTitle = chapter.title || '';
    let chapterTitle = rawTitle;
    chapterTitle = chapterTitle.replace(/^第\s*\d+\s*章\s*/, '');
    chapterTitle = chapterTitle.trim();

    const chapterNum = String(parseInt(String(chapter.chapterNumber), 10));
    let content = cleanChapterContent(chapter.content);

    addLog(platform, `准备发布: 序号=[${chapterNum}] 标题=[${chapterTitle}] 原始标题=[${rawTitle}] bookId=[${bookId}]`);

    addLog(platform, '敏感词预扫描...');
    const scanResult = scanSensitiveWords(content);
    if (!scanResult.clean) {
        const blockHits = scanResult.hits.filter(h => h.severity === 'block');
        if (blockHits.length > 0) {
            addLog(platform, `⚠ 敏感词拦截: ${scanResult.summary}`);
            content = scanResult.replacedContent;
            addLog(platform, `已自动替换敏感词，替换后继续发布`);
        }
    }
    if (scanResult.hasWarnings) {
        addLog(platform, `⚠ 敏感词警告: ${scanResult.summary}`);
    }

    const chapterManageUrl = `https://fanqienovel.com/main/writer/chapter-manage/${bookId}`;
    const draftUrl = `https://fanqienovel.com/main/writer/${bookId}/publish/?enter_from=newchapter_0`;

    addLog(platform, '导航到章节管理页...');
    await page.goto(chapterManageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const pageError = await page.evaluate(() => {
        const body = document.body?.innerText?.substring(0, 500) || '';
        if (/参数有误|书籍ID为空|404|页面不存在/.test(body)) return body.slice(0, 200);
        return null;
    });
    if (pageError) {
        throw new Error(`章节管理页报错: ${pageError} (bookId=${bookId}可能不正确)`);
    }

    await takeScreenshot(page, platform, 'chapter-manage');

    addLog(platform, '点击"新建章节"...');
    const newLink = page.locator('a[href*="/publish/"][href*="enter_from=newchapter"], a:has-text("新建章节")').first();
    if (await newLink.count()) {
        const href = await newLink.getAttribute('href').catch(() => null);
        if (href) {
            const targetUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        } else {
            await newLink.click({ timeout: 5000 }).catch(async () => newLink.click({ timeout: 5000, force: true }));
        }
    } else {
        const newBtn = page.locator('button').filter({ hasText: '新建章节' }).first();
        if (await newBtn.count()) {
            await newBtn.click({ timeout: 5000 }).catch(async () => newBtn.click({ timeout: 5000, force: true }));
        } else {
            addLog(platform, '未找到"新建章节"入口，直接导航到编辑器...');
            await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
        }
    }
    await page.waitForTimeout(3500);
    if (!/\/publish\//.test(page.url())) {
        await page.goto(draftUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
    }

    await dismissEditorGuides(page, platform);
    await takeScreenshot(page, platform, 'editor');
    await debugPageInputs(page, platform);

    const serialOk = await fillSerialInput(page, platform, chapterNum);
    if (!serialOk) {
        addLog(platform, '⚠ 章节序号未能填入，发布可能失败！');
    }
    await page.waitForTimeout(500);

    const titleOk = await fillTitleInput(page, platform, chapterTitle);
    if (!titleOk) {
        addLog(platform, '⚠ 标题未能填入，发布可能失败！');
    }
    await page.waitForTimeout(500);

    addLog(platform, '填写正文(ProseMirror)...');
    const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
    if (await editor.count()) {
        await editor.click();
        await editor.evaluate((el, txt) => {
            el.focus();
            el.innerHTML = '';
            const lines = String(txt).split(/\n+/);
            for (const line of lines) {
                const p = document.createElement('p');
                p.textContent = line;
                el.appendChild(p);
            }
        }, content);
        addLog(platform, `正文已填(ProseMirror): ${content.length}字`);
    } else {
        addLog(platform, '未找到ProseMirror编辑器，尝试通用contentEditable...');
        const fallbackEditor = page.locator('[contenteditable="true"]').first();
        await fallbackEditor.click();
        await fallbackEditor.evaluate((el, txt) => {
            el.focus();
            el.innerHTML = '';
            const lines = String(txt).split(/\n+/);
            for (const line of lines) {
                const p = document.createElement('p');
                p.textContent = line;
                el.appendChild(p);
            }
        }, content);
        addLog(platform, `正文已填(fallback): ${content.length}字`);
    }

    await page.waitForTimeout(1500);
    await takeScreenshot(page, platform, 'filled');

    if (fillOnly) {
        addLog(platform, `[仅填充模式] 已填充: 第${chapterNum}章 ${chapterTitle}`);
        return { success: true, fillOnly: true };
    }

    addLog(platform, '等待"下一步"按钮启用...');
    const nextBtn = page.locator('.publish-button.auto-editor-next').first();
    try {
        await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
        const isDisabled = await nextBtn.isDisabled().catch(() => true);
        if (isDisabled) {
            addLog(platform, '"下一步"按钮当前disabled，等待启用(最多30秒)...');
            for (let wait = 0; wait < 30; wait++) {
                await page.waitForTimeout(1000);
                const stillDisabled = await nextBtn.isDisabled().catch(() => true);
                if (!stillDisabled) {
                    addLog(platform, '"下一步"按钮已启用！');
                    break;
                }
            }
            const finalDisabled = await nextBtn.isDisabled().catch(() => true);
            if (finalDisabled) {
                addLog(platform, '"下一步"按钮仍disabled，尝试force click...');
                await takeScreenshot(page, platform, 'next-still-disabled');
            }
        }
    } catch (e) {
        addLog(platform, `等待"下一步"按钮异常: ${e.message?.substring(0, 80)}`);
    }

    addLog(platform, '点击"下一步"...');
    if (await nextBtn.count()) {
        const isDisabled2 = await nextBtn.isDisabled().catch(() => false);
        if (isDisabled2) {
            addLog(platform, '按钮仍disabled，使用force click...');
            await nextBtn.click({ force: true }).catch(() => {});
        } else {
            await nextBtn.click();
        }
    } else {
        const fallbackNext = page.locator('button').filter({ hasText: '下一步' }).first();
        await fallbackNext.click({ timeout: 5000 }).catch(async () => fallbackNext.click({ timeout: 5000, force: true }));
    }
    await page.waitForTimeout(2000);
    await takeScreenshot(page, platform, 'after-next');

    addLog(platform, '处理拦路弹窗...');
    const gateResult = await handleInterceptors(page, platform);
    await takeScreenshot(page, platform, 'after-interceptors');
    addLog(platform, `弹窗处理结果: ${gateResult}`);

    const publishModal = page.locator('.arco-modal.publish-confirm-container-new').last();
    if (!await publishModal.count()) {
        addLog(platform, `未检测到最终发布弹窗，gateResult=${gateResult}，尝试再次点击下一步...`);
        const retryNext = page.locator('.publish-button.auto-editor-next, button').filter({ hasText: '下一步' }).first();
        if (await retryNext.count()) {
            await retryNext.click().catch(async () => retryNext.click({ force: true }));
            await page.waitForTimeout(2000);
        }
        const retryGate = await handleInterceptors(page, platform);
        addLog(platform, `重试弹窗处理结果: ${retryGate}`);
        const retryModal = page.locator('.arco-modal.publish-confirm-container-new').last();
        if (!await retryModal.count()) {
            throw new Error(`未检测到最终发布弹窗。gateResult=${gateResult}, retryGate=${retryGate}`);
        }
    }

    addLog(platform, '处理"是否使用AI"选项...');
    const noLabel = publishModal.locator('label').filter({ hasText: '否' }).first();
    if (await noLabel.count()) {
        await noLabel.click().catch(async () => noLabel.click({ force: true }));
        await page.waitForTimeout(500);
    }

    const selectedAiNo = await publishModal.evaluate((el) => {
        const textNodes = Array.from(el.querySelectorAll('label, .arco-radio, .arco-radio-wrapper, [role="radio"], span, div'));
        for (const node of textNodes) {
            const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
            if (text !== '否') continue;
            const cls = String(node.className || '');
            const checked = cls.includes('checked') || node.getAttribute('aria-checked') === 'true';
            const nestedChecked = !!node.querySelector('.checked, .arco-radio-checked, [aria-checked="true"]');
            if (checked || nestedChecked) return true;
        }
        return false;
    }).catch(() => false);

    if (!selectedAiNo) {
        addLog(platform, '未成功选中"是否使用AI=否"，尝试再次点击...');
        const radioNo = publishModal.locator('[role="radio"], .arco-radio').filter({ hasText: '否' }).first();
        if (await radioNo.count()) {
            await radioNo.click().catch(async () => radioNo.click({ force: true }));
            await page.waitForTimeout(500);
        }
    }

    await takeScreenshot(page, platform, 'modal-ai-no');

    addLog(platform, '点击"确认发布"...');
    const confirmBtn = publishModal.locator('button').filter({ hasText: '确认发布' }).first();
    if (!await confirmBtn.count()) {
        throw new Error('未找到"确认发布"按钮');
    }
    await confirmBtn.click().catch(async () => confirmBtn.click({ force: true }));
    await page.waitForTimeout(2500);

    const stillOnPublishModal = await page.locator('.arco-modal.publish-confirm-container-new').last().count();
    if (stillOnPublishModal) {
        addLog(platform, '点击"确认发布"后弹窗未关闭，可能"是否使用AI"未正确选中');
        await takeScreenshot(page, platform, 'modal-still-open');
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
    }

    await takeScreenshot(page, platform, 'after-confirm');

    addLog(platform, '验证发布结果...');
    const verify = await verifyFanqiePublished(page, bookId, chapterNum, chapterTitle);
    if (verify.found) {
        addLog(platform, `发布成功: 第${chapterNum}章 ${chapterTitle} (状态: ${verify.status})`);
        s.completedChapters++;
    } else {
        addLog(platform, `发布未确认: 第${chapterNum}章 ${chapterTitle}`);
        s.failedChapters++;
    }

    return { success: verify.found, verify };
}

async function verifyFanqiePublished(page, bookId, chapterNum, chapterTitle) {
    const chapterManageUrl = `https://fanqienovel.com/main/writer/chapter-manage/${bookId}`;
    await page.goto(chapterManageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const expectedFullTitle = `第${chapterNum}章 ${chapterTitle}`;
    return await page.evaluate(({ title, num }) => {
        const normalizedTitle = num ? `第${num}章 ${title}` : title;
        const rows = Array.from(document.querySelectorAll('.arco-table-tr, tr'));
        for (const row of rows) {
            const text = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text || !text.includes(normalizedTitle)) continue;
            const cells = Array.from(row.querySelectorAll('.arco-table-td, .arco-table-cell, td'))
                .map(el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            return {
                found: true,
                title: normalizedTitle,
                rowText: text,
                cells,
                status: cells[3] || null,
                publishTime: cells[4] || null,
            };
        }
        return { found: false, title: normalizedTitle };
    }, { title: chapterTitle, num: chapterNum });
}

async function publishChapterToQimao(page, chapter, bookId, fillOnly, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写七猫作品ID');
    }

    let rawTitle = chapter.title || '';
    let chapterTitle = rawTitle;
    chapterTitle = chapterTitle.replace(/^第\s*\d+\s*章\s*/, '');
    chapterTitle = chapterTitle.trim();
    if (chapterTitle.length > 20) chapterTitle = chapterTitle.substring(0, 20);

    const chapterNum = String(parseInt(String(chapter.chapterNumber), 10));
    let content = cleanChapterContent(chapter.content);

    addLog(platform, `准备发布: 序号=[${chapterNum}] 标题=[${chapterTitle}] 原始标题=[${rawTitle}] bookId=[${bookId}]`);

    addLog(platform, '敏感词预扫描...');
    const qScanResult = scanSensitiveWords(content);
    if (!qScanResult.clean) {
        const qBlockHits = qScanResult.hits.filter(h => h.severity === 'block');
        if (qBlockHits.length > 0) {
            addLog(platform, `⚠ 敏感词拦截: ${qScanResult.summary}`);
            content = qScanResult.replacedContent;
            addLog(platform, `已自动替换敏感词，替换后继续发布`);
        }
    }
    if (qScanResult.hasWarnings) {
        addLog(platform, `⚠ 敏感词警告: ${qScanResult.summary}`);
    }

    addLog(platform, '从首页进入，点击"新建章节"确保创建新章节...');
    await page.goto('https://zuozhe.qimao.com/front/index', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    let currentUrl = page.url();
    addLog(platform, `首页URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
        throw new Error('七猫需要重新登录');
    }

    let newChapterClicked = false;
    const newChapterBtn = page.locator('a.qm-btn.important-border').filter({ hasText: '新建章节' }).first();
    if (await newChapterBtn.count()) {
        addLog(platform, '找到"新建章节"按钮(important-border)，点击...');
        await newChapterBtn.click({ timeout: 5000 }).catch(async () => newChapterBtn.click({ timeout: 5000, force: true }));
        newChapterClicked = true;
    } else {
        const anyNewBtn = page.locator('a:has-text("新建章节"), button:has-text("新建章节")').first();
        if (await anyNewBtn.count()) {
            addLog(platform, '找到"新建章节"按钮(备用选择器)，点击...');
            await anyNewBtn.click({ timeout: 5000 }).catch(async () => anyNewBtn.click({ timeout: 5000, force: true }));
            newChapterClicked = true;
        }
    }

    if (!newChapterClicked) {
        addLog(platform, '首页未找到"新建章节"按钮，直接导航到编辑器...');
        const uploadUrl = `https://zuozhe.qimao.com/front/book-upload?id=${bookId}`;
        await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    currentUrl = page.url();
    addLog(platform, `编辑器URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
        throw new Error('七猫需要重新登录');
    }

    if (!currentUrl.includes('book-upload')) {
        addLog(platform, 'URL不含book-upload，尝试直接导航...');
        const uploadUrl = `https://zuozhe.qimao.com/front/book-upload?id=${bookId}`;
        await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);
        currentUrl = page.url();
        addLog(platform, `直接导航后URL: ${currentUrl}`);
    }

    await takeScreenshot(page, platform, 'qimao-editor');

    const editorCheck = await page.evaluate(() => {
        const titleInput = document.querySelector('input[placeholder*="章节名称"], input[placeholder*="请输入章节"]');
        const contentEditor = document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]');
        const chapterLabel = document.body?.innerText?.match(/第\s*(\d+)\s*章/)?.[0] || '';
        const prevLabel = document.body?.innerText?.match(/上一章节[：:]\s*(.+)/)?.[1] || '';
        return {
            hasTitleInput: !!titleInput,
            titlePlaceholder: titleInput?.placeholder || '',
            titleValue: titleInput?.value || '',
            hasContentEditor: !!contentEditor,
            contentText: contentEditor?.innerText?.substring(0, 100) || '',
            chapterLabel,
            prevChapter: prevLabel,
            allInputs: Array.from(document.querySelectorAll('input')).map(el => ({
                placeholder: el.placeholder || '',
                type: el.type,
                visible: el.offsetWidth > 0 && el.offsetHeight > 0,
                value: el.value || ''
            })).filter(el => el.visible)
        };
    });
    addLog(platform, `编辑器检测: 标题框=${editorCheck.hasTitleInput}(${editorCheck.titlePlaceholder}) 编辑器=${editorCheck.hasContentEditor} 章节标签=${editorCheck.chapterLabel} 上一章=${editorCheck.prevChapter}`);
    addLog(platform, `标题框当前值="${editorCheck.titleValue}" 编辑器内容(前100字)="${editorCheck.contentText}"`);
    addLog(platform, `可见input: ${JSON.stringify(editorCheck.allInputs)}`);

    if (!editorCheck.hasTitleInput) {
        addLog(platform, '未找到标题输入框，页面可能未正确加载！');
        await takeScreenshot(page, platform, 'qimao-no-title-input');
        throw new Error('七猫编辑器标题框未找到，页面可能未正确加载');
    }

    addLog(platform, `填写章节名(不含"第X章"): ${chapterTitle}`);
    const titleInput = page.locator('input[placeholder="请输入章节名称，最多20个字"]').first();
    if (await titleInput.count()) {
        await titleInput.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(200);
        await page.keyboard.type(chapterTitle, { delay: 50 });
        await page.waitForTimeout(500);
        const val = await titleInput.inputValue().catch(() => '');
        addLog(platform, `章节名填入后: 期望=${chapterTitle} 实际=${val}`);
        if (val !== chapterTitle) {
            addLog(platform, '键盘输入不匹配，尝试JS设值...');
            await titleInput.evaluate((el, title) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, title);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterTitle);
            await page.waitForTimeout(500);
            const val2 = await titleInput.inputValue().catch(() => '');
            addLog(platform, `JS设值后: 期望=${chapterTitle} 实际=${val2}`);
        }
    } else {
        addLog(platform, '未找到章节名输入框！');
        throw new Error('七猫章节名输入框未找到');
    }

    await page.waitForTimeout(500);

    addLog(platform, '点击编辑器区域并填写正文(纯正文，不含"第X章"前缀)...');
    const editor = page.locator('div.q-contenteditable.book[contenteditable="true"]').first();
    if (await editor.count()) {
        await editor.click();
        await page.waitForTimeout(500);

        await page.keyboard.press('Control+a');
        await page.waitForTimeout(200);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        await page.keyboard.press('Control+a');
        await page.waitForTimeout(200);
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);

        const remaining = await editor.evaluate(el => el.innerText?.trim()?.length || 0);
        if (remaining > 0) {
            addLog(platform, `编辑器仍有${remaining}字残留，用JS强制清空...`);
            await editor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
            await page.waitForTimeout(500);
            const remaining2 = await editor.evaluate(el => el.innerText?.trim()?.length || 0);
            addLog(platform, `JS清空后残留: ${remaining2}字`);
        }

        addLog(platform, `键盘输入正文(纯内容): ${content.length}字`);
        await page.keyboard.type(content, { delay: 5 });
        await page.waitForTimeout(2000);

        const textLen = await editor.evaluate(el => el.innerText?.length || 0);
        addLog(platform, `正文已填: ${textLen}字`);

        if (textLen < content.length * 0.8) {
            addLog(platform, `输入字数不足(期望${content.length}实际${textLen})，降低速度重试...`);
            await editor.click();
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(300);
            await editor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
            await page.waitForTimeout(300);
            await page.keyboard.type(content, { delay: 10 });
            await page.waitForTimeout(2000);
            const textLen2 = await editor.evaluate(el => el.innerText?.length || 0);
            addLog(platform, `重试后正文: ${textLen2}字`);
        }
    } else {
        addLog(platform, '未找到编辑器div.q-contenteditable.book，尝试通用选择器...');
        const fallbackEditor = page.locator('div[contenteditable="true"]').first();
        if (await fallbackEditor.count()) {
            await fallbackEditor.click();
            await page.waitForTimeout(500);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(300);
            await fallbackEditor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
            await page.waitForTimeout(300);

            addLog(platform, `键盘输入正文(fallback): ${content.length}字`);
            await page.keyboard.type(content, { delay: 5 });
            await page.waitForTimeout(2000);
        } else {
            addLog(platform, '所有编辑器选择器均未找到！');
            await takeScreenshot(page, platform, 'qimao-no-editor');
            throw new Error('七猫编辑器未找到');
        }
    }

    await page.waitForTimeout(1500);
    await takeScreenshot(page, platform, 'qimao-filled');

    const wordCount = await page.evaluate(() => {
        const bodyText = document.body?.innerText || '';
        const match = bodyText.match(/当前字数[：:]*\s*(\d+)/) || bodyText.match(/字数[：:]*\s*(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
    addLog(platform, `当前字数: ${wordCount}`);

    if (fillOnly) {
        addLog(platform, `[仅填充模式] 已填充: ${chapterTitle}`);
        return { success: true, fillOnly: true };
    }

    if (wordCount < 1000 && wordCount > 0) {
        addLog(platform, `字数不足1000(${wordCount}字)，七猫要求最少1000字才能发布，存为草稿...`);
        const draftBtn = page.locator('a:has-text("存为草稿")').first();
        if (await draftBtn.count()) {
            await draftBtn.click({ timeout: 5000 }).catch(async () => draftBtn.click({ force: true }).catch(() => {}));
            await page.waitForTimeout(3000);
            addLog(platform, `已存为草稿: ${chapterTitle} (${wordCount}字)`);
        }
        s.failedChapters++;
        return { success: false, reason: `字数不足: ${wordCount} < 1000` };
    }

    addLog(platform, '点击"立即发布"...');
    const publishBtn = page.locator('a:has-text("立即发布")').first();
    if (await publishBtn.count()) {
        await publishBtn.click({ timeout: 5000 }).catch(async () => await publishBtn.click({ force: true }).catch(() => {}));
        addLog(platform, '已点击"立即发布"');
    } else {
        addLog(platform, '未找到"立即发布"按钮！');
        await takeScreenshot(page, platform, 'qimao-no-publish-btn');
        throw new Error('七猫"立即发布"按钮未找到');
    }

    await page.waitForTimeout(2000);

    addLog(platform, '处理弹窗（可能先出现"重要提醒"）...');
    for (let round = 0; round < 8; round++) {
        await page.waitForTimeout(2000);

        const dialogInfo = await page.evaluate(() => {
            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
            for (const w of wrappers) {
                const style = window.getComputedStyle(w);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const dialog = w.querySelector('.el-dialog');
                if (!dialog) continue;
                const text = (dialog.innerText || '').trim();
                const buttons = Array.from(dialog.querySelectorAll('a, button')).map(el => ({
                    tag: el.tagName,
                    text: (el.innerText || '').trim(),
                    cls: (el.className || '').toString().substring(0, 60)
                }));
                return { text: text.substring(0, 500), buttons, visible: true };
            }
            const anyDialog = document.querySelector('.el-dialog');
            if (anyDialog) {
                const style2 = window.getComputedStyle(anyDialog);
                if (style2.display !== 'none') {
                    const text = (anyDialog.innerText || '').trim();
                    const buttons = Array.from(anyDialog.querySelectorAll('a, button')).map(el => ({
                        tag: el.tagName,
                        text: (el.innerText || '').trim(),
                        cls: (el.className || '').toString().substring(0, 60)
                    }));
                    return { text: text.substring(0, 500), buttons, visible: true };
                }
            }
            return { text: '', buttons: [], visible: false };
        });

        if (!dialogInfo.visible || !dialogInfo.text || dialogInfo.text.length < 5) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/发布成功|上传成功|保存成功|已发布|审核中|操作成功|提交成功/.test(pageText)) {
                addLog(platform, `检测到成功关键词，发布完成！`);
                break;
            }
            addLog(platform, `弹窗不可见(round${round})，继续等待...`);
            if (round >= 5) break;
            continue;
        }

        addLog(platform, `弹窗内容(round${round}): "${dialogInfo.text.substring(0, 150)}"`);
        addLog(platform, `弹窗按钮: ${JSON.stringify(dialogInfo.buttons)}`);

        if (/重要提醒|我已知晓|我已阅读|著作权|违规内容/.test(dialogInfo.text)) {
            addLog(platform, '检测到"重要提醒"弹窗，点击"我已阅读并知晓"...');
            let ackClicked = false;
            for (const btn of dialogInfo.buttons) {
                if (btn.text.includes('阅读') || btn.text.includes('知晓') || btn.text.includes('确认')) {
                    addLog(platform, `找到确认按钮: <${btn.tag}> "${btn.text}"`);
                    const loc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
                    if (await loc.count()) {
                        await loc.click({ timeout: 5000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                        ackClicked = true;
                    }
                    break;
                }
            }
            if (!ackClicked) {
                addLog(platform, 'Playwright未找到确认按钮，用JS遍历点击...');
                await page.evaluate(() => {
                    const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                    for (const w of wrappers) {
                        if (window.getComputedStyle(w).display === 'none') continue;
                        const dialog = w.querySelector('.el-dialog');
                        if (!dialog) continue;
                        const all = dialog.querySelectorAll('a, button, span, div');
                        for (const el of all) {
                            const t = (el.innerText || '').trim();
                            if (/阅读|知晓|确认/.test(t) && t.length < 20) {
                                el.click();
                                if (el.parentElement) el.parentElement.click();
                                return;
                            }
                        }
                    }
                });
            }
            await page.waitForTimeout(2000);
            continue;
        }

        if (/原创|AI生成|确认发布|含AI|内容声明/.test(dialogInfo.text)) {
            addLog(platform, '检测到发布确认弹窗，处理"内容声明"下拉框...');

            const currentSelectValue = await page.evaluate(() => {
                const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                for (const w of wrappers) {
                    if (window.getComputedStyle(w).display === 'none') continue;
                    const dialog = w.querySelector('.el-dialog');
                    if (!dialog) continue;
                    const input = dialog.querySelector('.el-select .el-input__inner');
                    if (input) return input.value || '';
                }
                return '';
            });
            addLog(platform, `当前内容声明值: "${currentSelectValue}"`);

            const aiTexts = ['含AI生成内容', 'AI生成内容', '含AI辅助创作', 'AI辅助'];
            const needSelectAI = !aiTexts.some(t => currentSelectValue.includes(t));

            if (needSelectAI) {
                addLog(platform, '需要选择AI声明，点击下拉框...');
                const selectInput = page.locator('.el-dialog__wrapper:not([style*="display: none"]) .el-select .el-input__inner').first();
                if (await selectInput.count()) {
                    await selectInput.click({ timeout: 3000 }).catch(async () => selectInput.click({ force: true }).catch(() => {}));
                    addLog(platform, '已点击下拉框，等待选项列表...');
                    await page.waitForTimeout(1500);

                    let aiSelected = false;

                    const aiOption = page.locator('.el-select-dropdown__item').filter({ hasText: '含AI生成内容' }).first();
                    if (await aiOption.count()) {
                        const box = await aiOption.boundingBox().catch(() => null);
                        if (box) {
                            addLog(platform, `找到AI选项坐标: x=${box.x} y=${box.y} w=${box.width} h=${box.height}`);
                            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                            addLog(platform, '已用mouse.click选择"含AI生成内容"');
                            aiSelected = true;
                        } else {
                            await aiOption.click({ timeout: 3000 }).catch(async () => aiOption.click({ force: true }).catch(() => {}));
                            addLog(platform, '已用Playwright click选择"含AI生成内容"');
                            aiSelected = true;
                        }
                        await page.waitForTimeout(1000);
                    }

                    if (!aiSelected) {
                        addLog(platform, 'Playwright下拉选项未匹配，用JS鼠标事件...');
                        const jsResult = await page.evaluate((targetTexts) => {
                            const dropdowns = document.querySelectorAll('.el-select-dropdown');
                            for (const dd of dropdowns) {
                                if (window.getComputedStyle(dd).display === 'none') continue;
                                const items = dd.querySelectorAll('.el-select-dropdown__item');
                                for (const item of items) {
                                    const text = (item.textContent || '').trim();
                                    if (targetTexts.some(t => text.includes(t))) {
                                        item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                                        item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                                        item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                        item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                        return `dispatched events on: "${text}"`;
                                    }
                                }
                                const allTexts = Array.from(items).map(i => (i.textContent || '').trim());
                                return `not found in visible dropdown. Items: ${JSON.stringify(allTexts)}`;
                            }
                            return 'no visible dropdown found';
                        }, aiTexts);
                        addLog(platform, `JS鼠标事件结果: ${jsResult}`);
                        await page.waitForTimeout(1000);
                    }

                    const afterSelectValue = await page.evaluate(() => {
                        const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                        for (const w of wrappers) {
                            if (window.getComputedStyle(w).display === 'none') continue;
                            const dialog = w.querySelector('.el-dialog');
                            if (!dialog) continue;
                            const input = dialog.querySelector('.el-select .el-input__inner');
                            if (input) return input.value || '';
                        }
                        return '';
                    });
                    addLog(platform, `选择后内容声明值: "${afterSelectValue}"`);
                } else {
                    addLog(platform, '未找到下拉框，尝试旧方式...');
                    for (const aiText of aiTexts) {
                        const loc = page.locator(`.el-dialog :text-is("${aiText}"), .el-dialog span:has-text("${aiText}"), .el-dialog label:has-text("${aiText}")`).first();
                        if (await loc.count()) {
                            await loc.click({ timeout: 3000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                            addLog(platform, `已选择"${aiText}"(旧方式)`);
                            await page.waitForTimeout(500);
                            break;
                        }
                    }
                }
            } else {
                addLog(platform, `内容声明已正确设置为"${currentSelectValue}"`);
            }

            await takeScreenshot(page, platform, 'qimao-ai-selected');

            addLog(platform, '等待5秒让AI声明生效，然后点击"确认发布"...');
            await page.waitForTimeout(5000);

            addLog(platform, '点击"确认发布"...');
            const confirmBtn = page.locator('.el-dialog a.qm-btn.important:has-text("确认发布"), .el-dialog a:has-text("确认发布"), .el-dialog button:has-text("确认发布")').first();
            if (await confirmBtn.count()) {
                await confirmBtn.click({ timeout: 5000 }).catch(async () => confirmBtn.click({ force: true }).catch(() => {}));
                addLog(platform, '已点击"确认发布"');
            } else {
                addLog(platform, 'Playwright未找到确认按钮，用JS...');
                await page.evaluate(() => {
                    const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                    for (const w of wrappers) {
                        if (window.getComputedStyle(w).display === 'none') continue;
                        const dialog = w.querySelector('.el-dialog');
                        if (!dialog) continue;
                        const all = dialog.querySelectorAll('a, button');
                        for (const el of all) {
                            const text = (el.innerText || '').trim();
                            if (text.includes('确认发布') || text.includes('发布')) {
                                el.click();
                                return;
                            }
                        }
                    }
                });
            }

            await page.waitForTimeout(3000);

            addLog(platform, '检查选择AI声明后是否出现二次确认弹窗...');
            for (let ackRound = 0; ackRound < 5; ackRound++) {
                await page.waitForTimeout(2000);

                const ackDialogInfo = await page.evaluate(() => {
                    const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                    for (const w of wrappers) {
                        const style = window.getComputedStyle(w);
                        if (style.display === 'none' || style.visibility === 'hidden') continue;
                        const dialog = w.querySelector('.el-dialog');
                        if (!dialog) continue;
                        const text = (dialog.innerText || '').trim();
                        const buttons = Array.from(dialog.querySelectorAll('a, button')).map(el => ({
                            tag: el.tagName,
                            text: (el.innerText || '').trim(),
                            cls: (el.className || '').toString().substring(0, 60)
                        }));
                        return { text: text.substring(0, 500), buttons, visible: true };
                    }
                    return { text: '', buttons: [], visible: false };
                });

                if (!ackDialogInfo.visible || !ackDialogInfo.text || ackDialogInfo.text.length < 5) {
                    addLog(platform, `ack弹窗不可见(round${ackRound})，检查是否已发布成功...`);
                    const pageText2 = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
                    if (/发布成功|上传成功|保存成功|已发布|审核中|操作成功|提交成功/.test(pageText2)) {
                        addLog(platform, `检测到成功关键词，发布完成！`);
                        break;
                    }
                    if (ackRound >= 3) break;
                    continue;
                }

                addLog(platform, `ack弹窗(round${ackRound}): "${ackDialogInfo.text.substring(0, 150)}"`);
                addLog(platform, `ack弹窗按钮: ${JSON.stringify(ackDialogInfo.buttons)}`);

                if (/我已阅读|我已阅读知晓|阅读并知晓|AI生成内容声明/.test(ackDialogInfo.text)) {
                    addLog(platform, '检测到"我已阅读知晓"弹窗，等待5秒后点击确认...');
                    await page.waitForTimeout(5000);

                    let ackClicked = false;
                    for (const btn of ackDialogInfo.buttons) {
                        if (/我已阅读|阅读知晓|知晓|确认|确定/.test(btn.text)) {
                            addLog(platform, `找到确认按钮: <${btn.tag}> "${btn.text}"`);
                            const ackLoc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
                            if (await ackLoc.count()) {
                                await ackLoc.click({ timeout: 5000 }).catch(async () => ackLoc.click({ force: true }).catch(() => {}));
                                ackClicked = true;
                            }
                            break;
                        }
                    }
                    if (!ackClicked) {
                        addLog(platform, 'Playwright未找到确认按钮，用JS遍历点击...');
                        await page.evaluate(() => {
                            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                            for (const w of wrappers) {
                                if (window.getComputedStyle(w).display === 'none') continue;
                                const dialog = w.querySelector('.el-dialog');
                                if (!dialog) continue;
                                const all = dialog.querySelectorAll('a, button, span, div');
                                for (const el of all) {
                                    const t = (el.innerText || '').trim();
                                    if (/我已阅读|阅读知晓|知晓|确认|确定/.test(t)) {
                                        el.click();
                                        if (el.parentElement) el.parentElement.click();
                                        return;
                                    }
                                }
                            }
                        });
                    }
                    await page.waitForTimeout(2000);
                    continue;
                }

                if (/立即发布确认|确认发布/.test(ackDialogInfo.text)) {
                    addLog(platform, '检测到二次"立即发布确认"弹窗，等待5秒后再次点击"确认发布"...');
                    await page.waitForTimeout(5000);

                    let confirmClicked = false;
                    for (const btn of ackDialogInfo.buttons) {
                        if (/确认发布/.test(btn.text)) {
                            addLog(platform, `找到"确认发布"按钮: <${btn.tag}> "${btn.text}" cls="${btn.cls}"`);
                            const confirmLoc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: '确认发布' }).first();
                            if (await confirmLoc.count()) {
                                await confirmLoc.click({ timeout: 5000 }).catch(async () => confirmLoc.click({ force: true }).catch(() => {}));
                                confirmClicked = true;
                            }
                            break;
                        }
                    }
                    if (!confirmClicked) {
                        addLog(platform, 'Playwright未找到确认按钮，用JS遍历点击...');
                        await page.evaluate(() => {
                            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                            for (const w of wrappers) {
                                if (window.getComputedStyle(w).display === 'none') continue;
                                const dialog = w.querySelector('.el-dialog');
                                if (!dialog) continue;
                                const all = dialog.querySelectorAll('a, button');
                                for (const el of all) {
                                    const t = (el.innerText || '').trim();
                                    if (t.includes('确认发布')) {
                                        el.click();
                                        if (el.parentElement) el.parentElement.click();
                                        return;
                                    }
                                }
                            }
                        });
                    }
                    await page.waitForTimeout(3000);
                    continue;
                }

                addLog(platform, `未知ack弹窗，尝试关闭或继续...`);
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(1000);
            }

            await page.waitForTimeout(5000);
            break;
        }

        addLog(platform, `未知弹窗内容，尝试关闭或继续...`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
    }

    await takeScreenshot(page, platform, 'qimao-after-confirm');

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '').catch(() => '');
    const currentUrlAfterPublish = page.url();
    addLog(platform, `发布后页面(前200字): ${pageText.substring(0, 200)}`);
    addLog(platform, `发布后URL: ${currentUrlAfterPublish}`);

    const successKeywords = ['发布成功', '上传成功', '保存成功', '已发布', '审核中', '章节已创建', '操作成功', '提交成功'];
    const pageSuccessKeywords = ['章节管理', '草稿箱', '审核状态', '新建章节'];
    const success = successKeywords.some(k => pageText.includes(k)) ||
                    pageSuccessKeywords.some(k => pageText.includes(k)) ||
                    !currentUrlAfterPublish.includes('book-upload');

    if (success) {
        addLog(platform, `发布成功: ${chapterTitle}`);
        s.completedChapters++;
    } else {
        addLog(platform, `发布未确认，尝试"存为草稿"...`);
        const draftBtn = page.locator('a:has-text("存为草稿")').first();
        if (await draftBtn.count()) {
            await draftBtn.click({ timeout: 5000 }).catch(async () => draftBtn.click({ force: true }).catch(() => {}));
            await page.waitForTimeout(3000);
            const draftText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/保存成功|草稿|已保存|操作成功/.test(draftText)) {
                addLog(platform, `已存为草稿: ${chapterTitle}`);
                s.completedChapters++;
            } else {
                addLog(platform, `草稿也未确认: ${chapterTitle}`);
                s.failedChapters++;
            }
        } else {
            addLog(platform, `发布未确认: ${chapterTitle}`);
            s.failedChapters++;
        }
    }

    return { success };
}

async function updateChapterToQimao(page, chapter, bookId, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写七猫作品ID');
    }

    let rawTitle = chapter.title || '';
    let chapterTitle = rawTitle;
    chapterTitle = chapterTitle.replace(/^第\s*\d+\s*章\s*/, '');
    chapterTitle = chapterTitle.trim();
    if (chapterTitle.length > 20) chapterTitle = chapterTitle.substring(0, 20);

    const chapterNum = String(parseInt(String(chapter.chapterNumber), 10));
    let content = cleanChapterContent(chapter.content);

    addLog(platform, `[修改模式] 准备修改: 序号=[${chapterNum}] 标题=[${chapterTitle}] bookId=[${bookId}]`);

    addLog(platform, '敏感词预扫描...');
    const qScanResult = scanSensitiveWords(content);
    if (!qScanResult.clean) {
        const qBlockHits = qScanResult.hits.filter(h => h.severity === 'block');
        if (qBlockHits.length > 0) {
            addLog(platform, `⚠ 敏感词拦截: ${qScanResult.summary}`);
            content = qScanResult.replacedContent;
            addLog(platform, `已自动替换敏感词，替换后继续修改`);
        }
    }

    addLog(platform, '导航到七猫章节管理页（默认倒序，最新章在前）...');
    const manageUrl = `https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=1`;
    await page.goto(manageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    let currentUrl = page.url();
    addLog(platform, `章节管理页URL: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
        throw new Error('七猫需要重新登录');
    }

    await takeScreenshot(page, platform, 'qimao-chapter-manage');

    addLog(platform, '获取页面信息（总页数、章节范围）...');
    const pageInfo = await page.evaluate(() => {
        const chapterNums = [];
        const tableRows = document.querySelectorAll('.el-table__row');
        for (const row of tableRows) {
            const text = row.innerText || '';
            const numMatch = text.match(/第\s*(\d+)\s*章/);
            if (numMatch) chapterNums.push(parseInt(numMatch[1], 10));
        }
        const uniqueNums = [...new Set(chapterNums)].sort((a, b) => a - b);
        const maxChapter = uniqueNums[uniqueNums.length - 1] || 0;
        const itemsPerPage = uniqueNums.length;
        const totalPages = itemsPerPage > 0 ? Math.ceil(maxChapter / itemsPerPage) : 1;

        return {
            totalPages,
            chapterNums: uniqueNums,
            minChapter: uniqueNums[0] || 0,
            maxChapter,
            itemsPerPage
        };
    });
    addLog(platform, `页面信息: 总页数=${pageInfo.totalPages} 当前页章节=${pageInfo.minChapter}-${pageInfo.maxChapter} 每页${pageInfo.itemsPerPage}章`);

    const targetChapterNum = parseInt(chapterNum, 10);
    let targetPage = 1;

    if (pageInfo.itemsPerPage > 0 && pageInfo.maxChapter > 0) {
        targetPage = Math.ceil((pageInfo.maxChapter - targetChapterNum + 1) / pageInfo.itemsPerPage);
        targetPage = Math.max(1, Math.min(targetPage, pageInfo.totalPages));
    }
    addLog(platform, `计算目标页: 第${chapterNum}章应在第${targetPage}页(总${pageInfo.totalPages}页)`);

    if (targetPage > 1) {
        addLog(platform, `跳转到第${targetPage}页...`);
        const targetPageUrl = `https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${targetPage}`;
        await page.goto(targetPageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
    }

    addLog(platform, `在第${targetPage}页查找第${chapterNum}章的"修改"按钮...`);

    let editClicked = null;

    const tryFindAndClickModify = async () => {
        const result = await page.evaluate((num) => {
            const tableRows = document.querySelectorAll('.el-table__row');
            for (const row of tableRows) {
                const text = row.innerText || '';
                const numMatch = text.match(/第\s*(\d+)\s*章/);
                if (numMatch && numMatch[1] === num) {
                    const links = row.querySelectorAll('a, button');
                    for (const link of links) {
                        const linkText = (link.innerText || '').trim();
                        const href = link.href || link.getAttribute('href') || '';
                        if (linkText === '修改' || linkText === '编辑' || href.includes('book-upload') || href.includes('edit')) {
                            link.click();
                            return { found: true, method: 'click', linkText, href: href.substring(0, 100), rowText: text.substring(0, 100) };
                        }
                    }
                }
            }
            const allLinks = document.querySelectorAll('a[href*="book-upload"], a[href*="edit"]');
            for (const a of allLinks) {
                const row = a.closest('.el-table__row, tr');
                if (row) {
                    const rowText = row.innerText || '';
                    if (rowText.includes(`第${num}章`)) {
                        a.click();
                        return { found: true, method: 'href-click', href: a.href.substring(0, 100), rowText: rowText.substring(0, 100) };
                    }
                }
            }
            return { found: false };
        }, chapterNum);
        return result;
    };

    editClicked = await tryFindAndClickModify();

    if (!editClicked.found) {
        addLog(platform, `第${targetPage}页未找到，搜索相邻页(前后各3页)...`);
        const searchPages = [];
        for (let offset = 1; offset <= 3; offset++) {
            if (targetPage - offset >= 1) searchPages.push(targetPage - offset);
            if (targetPage + offset <= pageInfo.totalPages) searchPages.push(targetPage + offset);
        }
        for (const pageIdx of searchPages) {
            addLog(platform, `尝试第${pageIdx}页...`);
            const pageUrl = `https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${pageIdx}`;
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);
            editClicked = await tryFindAndClickModify();
            if (editClicked.found) {
                addLog(platform, `第${pageIdx}页找到第${chapterNum}章修改按钮`);
                break;
            }
        }
    }

    if (!editClicked?.found) {
        addLog(platform, `相邻页未找到，扩大搜索范围(1-${pageInfo.totalPages})...`);
        for (let pageIdx = 1; pageIdx <= pageInfo.totalPages; pageIdx++) {
            if (Math.abs(pageIdx - targetPage) <= 3) continue;
            const pageUrl = `https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${pageIdx}`;
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);
            editClicked = await tryFindAndClickModify();
            if (editClicked.found) {
                addLog(platform, `第${pageIdx}页找到第${chapterNum}章修改按钮`);
                break;
            }
        }
    }

    if (!editClicked?.found) {
        addLog(platform, `Playwright定位第${chapterNum}章修改按钮...`);
        const chapterRow = page.locator(`tr:has-text("第${chapterNum}章"), .el-table__row:has-text("第${chapterNum}章")`).first();
        if (await chapterRow.count()) {
            const editBtn = chapterRow.locator('a:has-text("修改"), button:has-text("修改")').first();
            if (await editBtn.count()) {
                await editBtn.click({ timeout: 5000 }).catch(async () => editBtn.click({ force: true }).catch(() => {}));
                editClicked = { found: true, method: 'playwright' };
            }
        }
    }

    if (editClicked?.found) {
        addLog(platform, `已点击修改按钮: ${JSON.stringify(editClicked)}`);
    } else {
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '').catch(() => '');
        addLog(platform, `未找到第${chapterNum}章修改按钮，页面文本: ${pageText.substring(0, 300)}`);
        throw new Error(`七猫章节管理页未找到第${chapterNum}章的修改按钮，可能章节不存在或页面结构变化`);
    }

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    currentUrl = page.url();
    addLog(platform, `点击修改后URL: ${currentUrl}`);

    const quickEditorCheck = await page.evaluate(() => {
        const contentEditor = document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]');
        return !!contentEditor;
    });

    if (!quickEditorCheck) {
        addLog(platform, '编辑器未立即出现，等待页面加载...');
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        currentUrl = page.url();
        addLog(platform, `等待后URL: ${currentUrl}`);
    }

    if (currentUrl.includes('book-manage') && !quickEditorCheck) {
        addLog(platform, '仍在章节管理页且编辑器未出现，可能修改按钮未生效，尝试Playwright直接点击...');
        const modifyBtn = page.locator(`tr:has-text("第${chapterNum}章") a:has-text("修改"), tr:has-text("第${chapterNum}章") button:has-text("修改")`).first();
        if (await modifyBtn.count()) {
            await modifyBtn.click({ timeout: 5000 }).catch(async () => modifyBtn.click({ force: true }).catch(() => {}));
            addLog(platform, 'Playwright重新点击修改按钮');
            await page.waitForTimeout(5000);
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        }
    }

    await takeScreenshot(page, platform, 'qimao-edit-page');

    const editorCheck = await page.evaluate(() => {
        const titleInput = document.querySelector('input[placeholder*="章节名称"], input[placeholder*="请输入章节"]');
        const contentEditor = document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]');
        return {
            hasTitleInput: !!titleInput,
            titleValue: titleInput?.value || '',
            hasContentEditor: !!contentEditor,
            contentText: contentEditor?.innerText?.substring(0, 100) || ''
        };
    });
    addLog(platform, `编辑器检测: 标题框=${editorCheck.hasTitleInput}("${editorCheck.titleValue}") 编辑器=${editorCheck.hasContentEditor} 内容前100字="${editorCheck.contentText}"`);

    if (!editorCheck.hasContentEditor) {
        addLog(platform, '编辑器未找到，等待页面加载并重试...');
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        currentUrl = page.url();
        addLog(platform, `重试前URL: ${currentUrl}`);

        if (!currentUrl.includes('book-upload') && !currentUrl.includes('edit') && !currentUrl.includes('book-manage')) {
            addLog(platform, 'URL不含编辑页特征，返回章节管理页重新点击修改...');
            await page.goto(`https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${targetPage}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            const retryEditBtn = page.locator(`text=修改`).first();
            if (await retryEditBtn.count()) {
                await retryEditBtn.click({ timeout: 5000 }).catch(() => {});
                await page.waitForTimeout(3000);
            }
        }

        await takeScreenshot(page, platform, 'qimao-edit-retry');

        const editorCheck2 = await page.evaluate(() => {
            const titleInput = document.querySelector('input[placeholder*="章节名称"], input[placeholder*="请输入章节"]');
            const contentEditor = document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]');
            return {
                hasTitleInput: !!titleInput,
                titleValue: titleInput?.value || '',
                hasContentEditor: !!contentEditor,
                contentText: contentEditor?.innerText?.substring(0, 100) || ''
            };
        });
        addLog(platform, `编辑器重试: 标题框=${editorCheck2.hasTitleInput}("${editorCheck2.titleValue}") 编辑器=${editorCheck2.hasContentEditor}`);

        if (!editorCheck2.hasContentEditor) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            addLog(platform, `页面文本前500字: ${pageText}`);
            throw new Error('七猫编辑器未找到，可能未正确进入编辑页。请检查bookId是否正确，或手动在七猫后台打开章节编辑页确认页面结构');
        }
    }

    addLog(platform, `修改章节名: ${chapterTitle}`);
    if (editorCheck.hasTitleInput) {
        const titleInput = page.locator('input[placeholder="请输入章节名称，最多20个字"]').first();
        if (await titleInput.count()) {
            await titleInput.click({ timeout: 3000 }).catch(() => {});
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterTitle, { delay: 50 });
            await page.waitForTimeout(500);
            const val = await titleInput.inputValue().catch(() => '');
            if (val !== chapterTitle) {
                await titleInput.evaluate((el, title) => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(el, title);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, chapterTitle);
                await page.waitForTimeout(500);
            }
        }
    }

    addLog(platform, '清空编辑器并填入新内容...');
    const editor = page.locator('div.q-contenteditable.book[contenteditable="true"]').first();
    if (!await editor.count()) {
        const fallbackEditor = page.locator('div[contenteditable="true"]').first();
        if (!await fallbackEditor.count()) {
            throw new Error('七猫编辑器未找到');
        }
    }

    const activeEditor = await editor.count() ? editor : page.locator('div[contenteditable="true"]').first();
    await activeEditor.click();
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    const remaining = await activeEditor.evaluate(el => el.innerText?.trim()?.length || 0);
    if (remaining > 0) {
        addLog(platform, `编辑器仍有${remaining}字残留，用JS强制清空...`);
        await activeEditor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
        await page.waitForTimeout(500);
    }

    addLog(platform, `键盘输入新正文: ${content.length}字`);
    await page.keyboard.type(content, { delay: 5 });
    await page.waitForTimeout(2000);

    const textLen = await activeEditor.evaluate(el => el.innerText?.length || 0);
    addLog(platform, `正文已填: ${textLen}字`);

    if (textLen < content.length * 0.8) {
        addLog(platform, `输入字数不足(期望${content.length}实际${textLen})，降低速度重试...`);
        await activeEditor.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(300);
        await activeEditor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
        await page.waitForTimeout(300);
        await page.keyboard.type(content, { delay: 10 });
        await page.waitForTimeout(2000);
        const textLen2 = await activeEditor.evaluate(el => el.innerText?.length || 0);
        addLog(platform, `重试后正文: ${textLen2}字`);
    }

    await page.waitForTimeout(1500);
    await takeScreenshot(page, platform, 'qimao-update-filled');

    addLog(platform, '点击"更新章节"...');
    const saveBtn = page.locator('a:has-text("更新章节"), a:has-text("保存修改"), a:has-text("保存"), button:has-text("更新章节"), button:has-text("保存修改"), button:has-text("保存")').first();
    if (await saveBtn.count()) {
        await saveBtn.click({ timeout: 5000 }).catch(async () => await saveBtn.click({ force: true }).catch(() => {}));
        addLog(platform, '已点击"更新章节"');
    } else {
        addLog(platform, '未找到"更新章节"按钮，尝试"立即发布"...');
        const publishBtn = page.locator('a:has-text("立即发布")').first();
        if (await publishBtn.count()) {
            await publishBtn.click({ timeout: 5000 }).catch(async () => await publishBtn.click({ force: true }).catch(() => {}));
            addLog(platform, '已点击"立即发布"');
        } else {
            addLog(platform, '未找到更新/发布按钮！');
            await takeScreenshot(page, platform, 'qimao-no-save-btn');
            throw new Error('七猫"更新章节"或"立即发布"按钮未找到');
        }
    }

    await page.waitForTimeout(2000);

    addLog(platform, '处理弹窗...');
    for (let round = 0; round < 8; round++) {
        await page.waitForTimeout(2000);

        const dialogInfo = await page.evaluate(() => {
            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
            for (const w of wrappers) {
                const style = window.getComputedStyle(w);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
                const dialog = w.querySelector('.el-dialog');
                if (!dialog) continue;
                const text = (dialog.innerText || '').trim();
                const buttons = Array.from(dialog.querySelectorAll('a, button')).map(el => ({
                    tag: el.tagName,
                    text: (el.innerText || '').trim(),
                    cls: (el.className || '').toString().substring(0, 60)
                }));
                return { text: text.substring(0, 500), buttons, visible: true };
            }
            return { text: '', buttons: [], visible: false };
        });

        if (!dialogInfo.visible || !dialogInfo.text || dialogInfo.text.length < 5) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/保存成功|修改成功|发布成功|操作成功|提交成功|审核中/.test(pageText)) {
                addLog(platform, `检测到成功关键词，修改完成！`);
                break;
            }
            if (round >= 5) break;
            continue;
        }

        addLog(platform, `弹窗内容(round${round}): "${dialogInfo.text.substring(0, 150)}"`);

        if (/重要提醒|我已知晓|我已阅读|著作权|违规内容/.test(dialogInfo.text)) {
            for (const btn of dialogInfo.buttons) {
                if (btn.text.includes('阅读') || btn.text.includes('知晓') || btn.text.includes('确认')) {
                    const loc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
                    if (await loc.count()) {
                        await loc.click({ timeout: 5000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                    }
                    break;
                }
            }
            await page.waitForTimeout(2000);
            continue;
        }

        if (/原创|AI生成|确认发布|含AI|内容声明/.test(dialogInfo.text)) {
            const aiTexts = ['含AI生成内容', 'AI生成内容', '含AI辅助创作', 'AI辅助'];
            const currentSelectValue = await page.evaluate(() => {
                const wrappers = document.querySelectorAll('.el-dialog__wrapper');
                for (const w of wrappers) {
                    if (window.getComputedStyle(w).display === 'none') continue;
                    const dialog = w.querySelector('.el-dialog');
                    if (!dialog) continue;
                    const input = dialog.querySelector('.el-select .el-input__inner');
                    if (input) return input.value || '';
                }
                return '';
            });
            const needSelectAI = !aiTexts.some(t => currentSelectValue.includes(t));
            if (needSelectAI) {
                addLog(platform, '选择"含AI生成内容"...');
                const selectTrigger = page.locator('.el-dialog .el-select .el-input').first();
                if (await selectTrigger.count()) {
                    await selectTrigger.click({ timeout: 3000 }).catch(() => {});
                    await page.waitForTimeout(1000);
                    const aiOption = page.locator('.el-select-dropdown__item').filter({ hasText: /含AI|AI生成/ }).first();
                    if (await aiOption.count()) {
                        await aiOption.click({ timeout: 5000 }).catch(async () => {
                            await page.evaluate(() => {
                                const items = document.querySelectorAll('.el-select-dropdown__item');
                                for (const item of items) {
                                    if (/含AI|AI生成/.test(item.innerText)) { item.click(); break; }
                                }
                            });
                        });
                    }
                    await page.waitForTimeout(1000);
                }
            }

            for (const btn of dialogInfo.buttons) {
                if (btn.text.includes('确认发布') || btn.text.includes('确认') || btn.text.includes('发布')) {
                    const loc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
                    if (await loc.count()) {
                        await loc.click({ timeout: 5000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                    }
                    break;
                }
            }
            await page.waitForTimeout(2000);
            continue;
        }

        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
    }

    await takeScreenshot(page, platform, 'qimao-update-done');

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '').catch(() => '');
    const currentUrlAfterSave = page.url();
    const successKeywords = ['更新成功', '保存成功', '修改成功', '发布成功', '操作成功', '提交成功', '审核中'];
    const pageSuccessKeywords = ['章节管理', '草稿箱', '审核状态'];
    const success = successKeywords.some(k => pageText.includes(k)) ||
                    pageSuccessKeywords.some(k => pageText.includes(k)) ||
                    !currentUrlAfterSave.includes('book-upload');

    if (success) {
        addLog(platform, `[修改模式] 修改成功: ${chapterTitle}`);
        s.completedChapters++;
    } else {
        addLog(platform, `[修改模式] 修改结果未确认: ${chapterTitle}`);
        s.failedChapters++;
    }

    return { success };
}

async function updateChaptersToQimao(platform, projectId, options = {}) {
    const cfg = PLATFORMS[platform];
    if (!cfg) return { success: false, error: `不支持的平台: ${platform}` };

    const { cdpUrl = '', bookId: rawBookId = '', chapterNumbers = [] } = options;
    const bookId = String(rawBookId).trim();
    const s = publishStates[platform];

    if (s.running) return { success: false, error: `${cfg.name}已有发布任务在运行中` };

    s.running = true; s.stopped = false; s.logs = []; s.completedChapters = 0; s.failedChapters = 0; s.currentChapter = null;

    try {
        addLog(platform, '[修改模式] 连接浏览器...');
        let page = await connectBrowser(platform, cdpUrl);

        addLog(platform, '[修改模式] 检查登录状态...');
        const loggedIn = await ensureLogin(platform, page, 600000);
        if (!loggedIn) {
            s.running = false;
            return { success: false, error: '登录超时' };
        }

        if (!bookId || bookId === 'undefined' || bookId === 'null') {
            s.running = false;
            return { success: false, error: '七猫作品ID(bookId)为空' };
        }

        const chapters = store.queryItems('chapters', { projectId })
            .filter(ch => ch.content && chapterNumbers.includes(ch.chapterNumber))
            .sort((a, b) => a.chapterNumber - b.chapterNumber);

        s.totalChapters = chapters.length;
        addLog(platform, `[修改模式] 共 ${chapters.length} 章待修改`);

        for (let i = 0; i < chapters.length; i++) {
            if (s.stopped) { addLog(platform, '[修改模式] 已停止'); break; }
            const chapter = chapters[i];
            s.currentChapter = chapter;
            addLog(platform, `[修改模式] 正在修改: 第${chapter.chapterNumber}章 (${chapter.content?.length || 0}字)`);

            try {
                await updateChapterToQimao(page, chapter, bookId, platform);
            } catch (e) {
                addLog(platform, `[修改模式] 异常: 第${chapter.chapterNumber}章 - ${e.message}`);
                const isTargetClosed = /Target closed|Target page, context or browser has been closed|Execution context was destroyed/.test(e.message);
                if (isTargetClosed) {
                    addLog(platform, '[修改模式] 浏览器已关闭，尝试重新连接...');
                    try {
                        page = await connectBrowser(platform, cdpUrl);
                        const reLoggedIn = await ensureLogin(platform, page, 300000);
                        if (!reLoggedIn) { s.failedChapters++; break; }
                        addLog(platform, '[修改模式] 重连成功，重试当前章节...');
                        await updateChapterToQimao(page, chapter, bookId, platform);
                    } catch (retryErr) {
                        addLog(platform, `[修改模式] 重连重试也失败: ${retryErr.message}`);
                        s.failedChapters++;
                    }
                } else {
                    s.failedChapters++;
                }
            }

            await page.waitForTimeout(3000);
        }

        addLog(platform, `[修改模式] 完成: 成功${s.completedChapters}章 失败${s.failedChapters}章`);
    } catch (e) {
        addLog(platform, `[修改模式] 致命错误: ${e.message}`);
        s.failedChapters++;
    } finally {
        s.running = false;
        s.currentChapter = null;
    }

    return { success: s.failedChapters === 0, completed: s.completedChapters, failed: s.failedChapters };
}

async function publishChapterGeneric(page, chapter, platform, fillOnly) {
    const s = publishStates[platform];
    const cfg = PLATFORMS[platform];

    let chapterTitle = chapter.title || '';
    if (chapterTitle.match(/^第\d+章/)) {
        chapterTitle = chapterTitle.replace(/^第\d+章\s*/, '');
    }
    const title = `第${chapter.chapterNumber}章 ${chapterTitle}`;
    const content = cleanChapterContent(chapter.content);

    const createBtn = page.locator('button:has-text("新建章节"), a:has-text("新建章节"), button:has-text("创建章节")').first();
    await createBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await createBtn.click().catch(() => {});
    await page.waitForTimeout(2000);

    const titleInput = page.locator('input[placeholder*="标题"], input[placeholder*="章节名"], input[name*="title"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.click();
    await titleInput.fill(title);
    await page.waitForTimeout(500);

    const contentArea = page.locator('.ProseMirror[contenteditable="true"], [contenteditable="true"], textarea[placeholder*="正文"]').first();
    await contentArea.waitFor({ state: 'visible', timeout: 10000 });
    await contentArea.click();
    if (await page.locator('.ProseMirror[contenteditable="true"]').count()) {
        await contentArea.evaluate((el, txt) => {
            el.focus();
            el.innerHTML = '';
            const lines = String(txt).split(/\n+/);
            for (const line of lines) {
                const p = document.createElement('p');
                p.textContent = line;
                el.appendChild(p);
            }
        }, content);
    } else {
        await contentArea.fill('');
        await page.keyboard.type(content, { delay: 5 });
    }
    await page.waitForTimeout(1000);

    if (fillOnly) {
        addLog(platform, `[仅填充模式] 已填充: ${title}`);
        return { success: true, fillOnly: true };
    }

    const nextBtn = page.locator('button:has-text("下一步"), button:has-text("保存"), button:has-text("提交"), button:has-text("发布")').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 10000 });
    await nextBtn.click();
    await page.waitForTimeout(2000);

    const confirmBtn = page.locator('button:has-text("确认发布"), button:has-text("确认"), button:has-text("确定"), button:has-text("提交审核")').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await confirmBtn.click().catch(() => {});
    await page.waitForTimeout(3000);

    const pageContent = await page.content();
    const successKeywords = ['发布成功', '提交成功', '已发布', '审核中', '保存成功', '章节已创建', '创建成功'];
    const success = successKeywords.some(k => pageContent.includes(k));

    if (success) {
        addLog(platform, `发布成功: ${title}`);
        s.completedChapters++;
    } else {
        addLog(platform, `发布结果未确认: ${title}`);
        s.failedChapters++;
    }
    await page.waitForTimeout(3000);
    return { success };
}

async function publishToPlatform(platform, projectId, options = {}) {
    const cfg = PLATFORMS[platform];
    if (!cfg) return { success: false, error: `不支持的平台: ${platform}` };

    const { cdpUrl = '', bookId: rawBookId = '', mode = 'immediate', scheduleInterval = 30, startFrom = 1, endAt = 0, limit = 0, fillOnly = false, dailyLimitChars = 500000 } = options;
    const bookId = String(rawBookId).trim();
    const s = publishStates[platform];

    if (s.running) return { success: false, error: `${cfg.name}已有发布任务在运行中` };

    s.running = true; s.stopped = false; s.logs = []; s.completedChapters = 0; s.failedChapters = 0; s.currentChapter = null;
    const isCdpMode = !!cdpUrl;

    try {
        addLog(platform, '连接浏览器...');
        let page = await connectBrowser(platform, cdpUrl);

        addLog(platform, '检查登录状态...');
        const loggedIn = await ensureLogin(platform, page, 600000);
        if (!loggedIn) {
            s.running = false;
            return { success: false, error: '登录超时' };
        }
        addLog(platform, '登录状态确认');

        if (platform === 'fanqie') {
            if (!bookId || bookId === 'undefined' || bookId === 'null') {
                s.running = false;
                return { success: false, error: '番茄作品ID(bookId)为空！请在发布配置中填写正确的作品ID（从作者后台URL中获取，如 https://fanqienovel.com/main/writer/chapter-manage/7XXXXXXXXX 中的数字部分）' };
            }
            addLog(platform, `番茄作品ID: ${bookId}`);
        }
        if (platform === 'qimao') {
            if (!bookId || bookId === 'undefined' || bookId === 'null') {
                s.running = false;
                return { success: false, error: '七猫作品ID(bookId)为空！请在发布配置中填写正确的作品ID（从作者后台URL中获取）' };
            }
            addLog(platform, `七猫作品ID: ${bookId}`);
        }

        const chapters = store.queryItems('chapters', { projectId })
            .filter(ch => ch.content && ch.chapterNumber >= startFrom && (endAt <= 0 || ch.chapterNumber <= endAt))
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        if (limit > 0) chapters.splice(limit);
        s.totalChapters = chapters.length;
        addLog(platform, `共 ${chapters.length} 章待发布`);

        let publishedChars = 0;

        for (let i = 0; i < chapters.length; i++) {
            if (s.stopped) { addLog(platform, '发布已停止'); break; }
            const chapter = chapters[i];
            s.currentChapter = chapter;

            let chapterTitle = chapter.title || '';
            if (chapterTitle.match(/^第\d+章/)) {
                chapterTitle = chapterTitle.replace(/^第\d+章\s*/, '');
            }
            const content = cleanChapterContent(chapter.content);

            const minWords = cfg.minWordCount || 0;
            if (minWords > 0 && content.length < minWords) {
                addLog(platform, `跳过: 第${chapter.chapterNumber}章 ${chapterTitle} (${content.length}字 < 最低${minWords}字)`);
                s.failedChapters++;
                continue;
            }

            if (publishedChars + content.length > dailyLimitChars) {
                addLog(platform, `已达单日发布字数上限(${dailyLimitChars}字)，停止发布`);
                break;
            }
            addLog(platform, `正在发布: 第${chapter.chapterNumber}章 ${chapterTitle} (${content.length}字)`);

            try {
                if (platform === 'fanqie') {
                    const result = await publishChapterToFanqie(page, chapter, bookId, fillOnly, platform);
                    if (!result.fillOnly) {
                        publishedChars += content.length;
                    }
                } else if (platform === 'qimao') {
                    const result = await publishChapterToQimao(page, chapter, bookId, fillOnly, platform);
                    if (!result.fillOnly) {
                        publishedChars += content.length;
                    }
                } else {
                    const result = await publishChapterGeneric(page, chapter, platform, fillOnly);
                    if (!result.fillOnly) {
                        publishedChars += content.length;
                    }
                }
            } catch (e) {
                addLog(platform, `发布异常: 第${chapter.chapterNumber}章 ${chapterTitle} - ${e.message}`);

                if (/等待扫码登录超时|单日字数上限/.test(e.message)) {
                    s.failedChapters++;
                    break;
                }

                const isTargetClosed = /Target closed|Target page, context or browser has been closed|Execution context was destroyed/.test(e.message);
                if (isTargetClosed) {
                    addLog(platform, '浏览器已关闭，尝试重新连接...');
                    try {
                        page = await connectBrowser(platform, cdpUrl);
                        const reLoggedIn = await ensureLogin(platform, page, 300000);
                        if (!reLoggedIn) {
                            addLog(platform, '重连后登录超时，停止发布');
                            s.failedChapters++;
                            break;
                        }
                        addLog(platform, '重连成功，重试当前章节...');
                        if (platform === 'fanqie') {
                            await publishChapterToFanqie(page, chapter, bookId, fillOnly, platform);
                        } else if (platform === 'qimao') {
                            await publishChapterToQimao(page, chapter, bookId, fillOnly, platform);
                        } else {
                            await publishChapterGeneric(page, chapter, platform, fillOnly);
                        }
                        publishedChars += content.length;
                    } catch (retryErr) {
                        addLog(platform, `重连重试也失败: ${retryErr.message}`);
                        s.failedChapters++;
                    }
                } else if (/未检测到最终发布弹窗|弹窗仍未关闭|Navigation failed|Timeout|ERR_/.test(e.message)) {
                    addLog(platform, '检测到可恢复错误，准备重试...');
                    try {
                        if (platform === 'fanqie') {
                            const chapterManageUrl = `https://fanqienovel.com/main/writer/chapter-manage/${bookId}`;
                            await page.goto(chapterManageUrl, { waitUntil: 'domcontentloaded' });
                            await page.waitForTimeout(2000);
                        }
                        if (platform === 'qimao') {
                            const uploadUrl = `https://zuozhe.qimao.com/front/book-upload?id=${bookId}`;
                            await page.goto(uploadUrl, { waitUntil: 'domcontentloaded' });
                            await page.waitForTimeout(2000);
                        }
                        if (platform === 'fanqie') {
                            await publishChapterToFanqie(page, chapter, bookId, fillOnly, platform);
                        } else if (platform === 'qimao') {
                            await publishChapterToQimao(page, chapter, bookId, fillOnly, platform);
                        } else {
                            await publishChapterGeneric(page, chapter, platform, fillOnly);
                        }
                        publishedChars += content.length;
                    } catch (retryErr) {
                        addLog(platform, `重试也失败: ${retryErr.message}`);
                        s.failedChapters++;
                    }
                } else {
                    s.failedChapters++;
                }
            }
            await new Promise(r => setImmediate(r));
        }

        addLog(platform, `发布完成: 成功${s.completedChapters}章, 失败${s.failedChapters}章`);
        s.running = false; s.currentChapter = null;
        return { success: true, completed: s.completedChapters, failed: s.failedChapters };
    } catch (e) {
        addLog(platform, `发布流程异常: ${e.message}`);
        s.running = false; s.currentChapter = null;
        if (!isCdpMode) {
            try { if (s.context) await s.context.close(); } catch (ce) { }
            try { if (s.browser) await s.browser.close(); } catch (ce) { }
            s.browser = null; s.context = null; s.page = null;
            addLog(platform, '异常后已关闭浏览器');
        }
        return { success: false, error: e.message };
    }
}

async function checkPlatformLogin(platform, cdpUrl) {
    const cfg = PLATFORMS[platform];
    if (!cfg) return { loggedIn: false, error: `不支持的平台: ${platform}` };

    const s = publishStates[platform];
    try {
        addLog(platform, '连接浏览器检测登录...');
        const page = await connectBrowser(platform, cdpUrl);
        const result = await checkLoginStatus(platform, page);
        s.loginStatus = result.loggedIn ? 'logged-in' : 'not-logged-in';
        return result;
    } catch (e) {
        s.loginStatus = 'error';
        return { loggedIn: false, reason: `检测失败: ${e.message}` };
    }
}

async function openWriterBackend(platform, cdpUrl) {
    const cfg = PLATFORMS[platform];
    if (!cfg) return { success: false, error: `不支持的平台: ${platform}` };

    try {
        addLog(platform, '连接浏览器打开创作后台...');
        const page = await connectBrowser(platform, cdpUrl);
        await page.goto(cfg.writerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        addLog(platform, `已打开${cfg.name}创作后台: ${cfg.writerUrl}`);
        return { success: true, url: cfg.writerUrl };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function openFanqieBookEditor(platform, cdpUrl, bookId) {
    if (!bookId) return { success: false, error: '请提供作品ID' };
    try {
        addLog(platform, '连接浏览器打开作品编辑页...');
        const page = await connectBrowser(platform, cdpUrl);
        const url = `https://fanqienovel.com/main/writer/${bookId}/publish/?enter_from=newchapter_0`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        addLog(platform, `已打开番茄作品编辑页: ${url}`);
        return { success: true, url };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function stopPublish(platform) {
    if (publishStates[platform]) {
        publishStates[platform].stopped = true;
        addLog(platform, '正在停止发布...');
    }
    return { success: true };
}

async function closeBrowser(platform) {
    const s = publishStates[platform];
    if (s) {
        try { if (s.context) await s.context.close(); } catch (e) { }
        try { if (s.browser) await s.browser.close(); } catch (e) { }
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

process.on('SIGINT', async () => { await closeAllBrowsers(); process.exit(0); });
process.on('SIGTERM', async () => { await closeAllBrowsers(); process.exit(0); });

module.exports = {
    PLATFORMS,
    publishToPlatform,
    stopPublish,
    getPlatformState,
    getAllStates,
    closeBrowser,
    checkPlatformLogin,
    openWriterBackend,
    openFanqieBookEditor,
    ensureLogin,
    updateChaptersToQimao
};
