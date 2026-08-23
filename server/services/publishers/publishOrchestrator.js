const store = require('../../store');
const { cleanChapterContent } = require('../contentUtils');
const logger = require('../../shared/logger');
const { PLATFORMS, publishStates, addLog, connectBrowser, ensureLogin, closeAllBrowsers } = require('./PublisherBase');
const { publishSingleChapter } = require('./publishUtils');

async function publishToPlatform(platform, projectId, options = {}) {
    const cfg = PLATFORMS[platform];
    if (!cfg) return { success: false, error: `不支持的平台: ${platform}` };

    const { cdpUrl = '', bookId: rawBookId = '', mode = 'immediate', startFrom = 1, endAt = 0, limit = 0, fillOnly = false, dailyLimitChars = 500000 } = options;
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

        if ((platform === 'fanqie' || platform === 'qimao') && (!bookId || bookId === 'undefined' || bookId === 'null')) {
            s.running = false;
            return { success: false, error: `${cfg.name}作品ID(bookId)为空！请在发布配置中填写正确的作品ID` };
        }
        if (bookId) addLog(platform, `${cfg.name}作品ID: ${bookId}`);

        const chapters = (await store.queryItems('chapters', { projectId }))
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
                const result = await publishSingleChapter(page, platform, chapter, bookId, fillOnly);
                if (!result.fillOnly) publishedChars += content.length;
            } catch (e) {
                await handlePublishError(platform, page, chapter, bookId, fillOnly, cdpUrl, content, e, s);
                publishedChars += content.length;
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
            try { if (s.context) await s.context.close(); } catch (ce) {
                logger.debug('publishOrchestrator', 'Failed to close context on error', { error: ce.message });
            }
            try { if (s.browser) await s.browser.close(); } catch (ce) {
                logger.debug('publishOrchestrator', 'Failed to close browser on error', { error: ce.message });
            }
            s.browser = null; s.context = null; s.page = null;
            addLog(platform, '异常后已关闭浏览器');
        }
        return { success: false, error: e.message };
    }
}

async function handlePublishError(platform, page, chapter, bookId, fillOnly, cdpUrl, content, e, s) {
    addLog(platform, `发布异常: 第${chapter.chapterNumber}章 - ${e.message}`);

    if (/等待扫码登录超时|单日字数上限/.test(e.message)) {
        s.failedChapters++;
        throw new Error('unrecoverable');
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
                throw new Error('unrecoverable');
            }
            addLog(platform, '重连成功，重试当前章节...');
            await publishSingleChapter(page, platform, chapter, bookId, fillOnly);
        } catch (retryErr) {
            if (retryErr.message === 'unrecoverable') throw retryErr;
            addLog(platform, `重连重试也失败: ${retryErr.message}`);
            s.failedChapters++;
        }
    } else if (/未检测到最终发布弹窗|弹窗仍未关闭|Navigation failed|Timeout|ERR_/.test(e.message)) {
        addLog(platform, '检测到可恢复错误，准备重试...');
        try {
            await navigateToChapterManage(page, platform, bookId);
            await publishSingleChapter(page, platform, chapter, bookId, fillOnly);
        } catch (retryErr) {
            addLog(platform, `重试也失败: ${retryErr.message}`);
            s.failedChapters++;
        }
    } else {
        s.failedChapters++;
    }
}

async function navigateToChapterManage(page, platform, bookId) {
    if (platform === 'fanqie' && bookId) {
        await page.goto(`https://fanqienovel.com/main/writer/chapter-manage/${bookId}`, { waitUntil: 'domcontentloaded' });
    } else if (platform === 'qimao' && bookId) {
        await page.goto(`https://zuozhe.qimao.com/front/book-upload?id=${bookId}`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(2000);
}

module.exports = {
    publishToPlatform
};
