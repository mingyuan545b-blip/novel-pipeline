const { addLog, takeScreenshot, ensureLogin, connectBrowser, publishStates } = require('./PublisherBase');
const { prepareChapterData } = require('./qimaoChapterPrep');
const { fillTitle, fillContent, detectEditor } = require('./qimaoEditorFiller');
const { handlePublishDialogs } = require('./qimaoPublishDialogs');

async function publishChapterToQimao(page, chapter, bookId, fillOnly, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写七猫作品ID');
    }

    const { chapterTitle, chapterNum, content } = prepareChapterData(chapter);
    addLog(platform, `准备发布: 序号=[${chapterNum}] 标题=[${chapterTitle}] 字数=${content.length}`);

    const uploadUrl = `https://zuozhe.qimao.com/front/book-upload?id=${bookId}`;
    addLog(platform, `导航到七猫新建章节页: ${uploadUrl}`);
    await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
        throw new Error('七猫需要重新登录');
    }

    await takeScreenshot(page, platform, 'qimao-editor-page');

    const editorCheck = await detectEditor(page, platform);
    if (!editorCheck.hasTitleInput) {
        addLog(platform, '未找到标题输入框，页面可能未正确加载！');
        await takeScreenshot(page, platform, 'qimao-no-title-input');
        throw new Error('七猫编辑器标题框未找到，页面可能未正确加载');
    }

    addLog(platform, `填写章节名(不含"第X章"): ${chapterTitle}`);
    await fillTitle(page, platform, chapterTitle);
    await page.waitForTimeout(500);

    addLog(platform, '点击编辑器区域并填写正文...');
    await fillContent(page, platform, content);

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
        addLog(platform, `字数不足1000(${wordCount}字)，存为草稿...`);
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
    addLog(platform, '处理弹窗...');
    await handlePublishDialogs(page, platform);

    await takeScreenshot(page, platform, 'qimao-after-confirm');

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '').catch(() => '');
    const currentUrlAfterPublish = page.url();
    addLog(platform, `发布后页面(前200字): ${pageText.substring(0, 200)}`);

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
                s.failedChapters++;
            }
        } else {
            s.failedChapters++;
        }
    }

    return { success };
}

const { updateChapterToQimao, updateChaptersToQimao } = require('./qimaoUpdater');

module.exports = {
    publishChapterToQimao,
    updateChapterToQimao,
    updateChaptersToQimao
};
