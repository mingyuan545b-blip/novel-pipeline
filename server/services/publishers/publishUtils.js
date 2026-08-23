const store = require('../../store');
const { cleanChapterContent } = require('../contentUtils');
const logger = require('../../shared/logger');
const {
    PLATFORMS, publishStates, addLog, connectBrowser, ensureLogin,
    checkLoginStatus, closeAllBrowsers
} = require('./PublisherBase');
const { publishChapterToFanqie } = require('./fanqiePublisher');
const { publishChapterToQimao } = require('./qimaoPublisher');

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

async function publishSingleChapter(page, platform, chapter, bookId, fillOnly) {
    if (platform === 'fanqie') {
        return await publishChapterToFanqie(page, chapter, bookId, fillOnly, platform);
    } else if (platform === 'qimao') {
        return await publishChapterToQimao(page, chapter, bookId, fillOnly, platform);
    } else {
        return await publishChapterGeneric(page, chapter, platform, fillOnly);
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

module.exports = {
    publishChapterGeneric,
    publishSingleChapter,
    checkPlatformLogin,
    openWriterBackend,
    openFanqieBookEditor
};
