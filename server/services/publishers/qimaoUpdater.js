const store = require('../../store');
const { addLog, takeScreenshot, ensureLogin, connectBrowser, publishStates } = require('./PublisherBase');
const { prepareChapterData } = require('./qimaoChapterPrep');
const { fillTitle, fillContent, detectEditor } = require('./qimaoEditorFiller');
const { handleUpdateDialogs } = require('./qimaoUpdateDialogs');
const { getPageInfo, calculateTargetPage, findAndClickModify, waitForEditor } = require('./qimaoPageNavigator');

async function updateChapterToQimao(page, chapter, bookId, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写七猫作品ID');
    }

    const { chapterTitle, chapterNum, content } = prepareChapterData(chapter, true);
    addLog(platform, `[修改模式] 准备修改: 序号=[${chapterNum}] 标题=[${chapterTitle}] bookId=[${bookId}]`);

    addLog(platform, '导航到七猫章节管理页...');
    const manageUrl = `https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=1`;
    await page.goto(manageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    let currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('sign-in')) {
        throw new Error('七猫需要重新登录');
    }

    await takeScreenshot(page, platform, 'qimao-chapter-manage');

    const pageInfo = await getPageInfo(page, platform);
    const targetChapterNum = parseInt(chapterNum, 10);
    const targetPage = calculateTargetPage(pageInfo, targetChapterNum);
    addLog(platform, `计算目标页: 第${chapterNum}章应在第${targetPage}页(总${pageInfo.totalPages}页)`);

    if (targetPage > 1) {
        addLog(platform, `跳转到第${targetPage}页...`);
        await page.goto(`https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${targetPage}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);
    }

    const editClicked = await findAndClickModify(page, platform, chapterNum, pageInfo, bookId, targetPage);
    if (!editClicked) {
        throw new Error(`七猫章节管理页未找到第${chapterNum}章的修改按钮`);
    }

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    currentUrl = page.url();

    const editorReady = await waitForEditor(page, platform, currentUrl, bookId, targetPage, chapterNum);
    if (!editorReady) {
        throw new Error('七猫编辑器未找到，可能未正确进入编辑页');
    }

    await takeScreenshot(page, platform, 'qimao-edit-page');

    addLog(platform, `修改章节名: ${chapterTitle}`);
    const editorCheck = await detectEditor(page, platform);
    if (editorCheck.hasTitleInput) {
        await fillTitle(page, platform, chapterTitle);
    }

    addLog(platform, '清空编辑器并填入新内容...');
    await fillContent(page, platform, content);

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
        } else {
            throw new Error('七猫"更新章节"或"立即发布"按钮未找到');
        }
    }

    await page.waitForTimeout(2000);
    addLog(platform, '处理弹窗...');
    await handleUpdateDialogs(page, platform);

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
    const { PLATFORMS } = require('./PublisherBase');
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
        if (!loggedIn) { s.running = false; return { success: false, error: '登录超时' }; }

        if (!bookId || bookId === 'undefined' || bookId === 'null') {
            s.running = false; return { success: false, error: '七猫作品ID(bookId)为空' };
        }

        const chapters = (await store.queryItems('chapters', { projectId }))
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

module.exports = { updateChapterToQimao, updateChaptersToQimao };
