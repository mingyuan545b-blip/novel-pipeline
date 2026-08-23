const { cleanChapterContent } = require('../contentUtils');
const { addLog, takeScreenshot, dismissEditorGuides, debugPageInputs, publishStates } = require('./PublisherBase');
const { filterContent } = require('./sensitiveWordFilter');
const { fillSerialInput, fillTitleInput } = require('./fanqieFormFiller');
const { clickNextAndHandleGates, confirmPublishModal } = require('./fanqiePublishActions');

async function publishChapterToFanqie(page, chapter, bookId, fillOnly, platform) {
    const s = publishStates[platform];

    if (!bookId || bookId === 'undefined' || bookId === 'null') {
        throw new Error('作品ID(bookId)为空，请在发布配置中填写番茄作品ID');
    }

    let rawTitle = chapter.title || '';
    let chapterTitle = rawTitle.replace(/^第\s*\d+\s*章\s*/, '').trim();
    const chapterNum = String(parseInt(String(chapter.chapterNumber), 10));
    let content = cleanChapterContent(chapter.content);

    addLog(platform, `准备发布: 序号=[${chapterNum}] 标题=[${chapterTitle}] 原始标题=[${rawTitle}] bookId=[${bookId}]`);
    content = filterContent(content, platform);

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
    if (!serialOk) addLog(platform, '⚠ 章节序号未能填入，发布可能失败！');
    await page.waitForTimeout(500);

    const titleOk = await fillTitleInput(page, platform, chapterTitle);
    if (!titleOk) addLog(platform, '⚠ 标题未能填入，发布可能失败！');
    await page.waitForTimeout(500);

    await fillContentToEditor(page, platform, content);

    await page.waitForTimeout(1500);
    await takeScreenshot(page, platform, 'filled');

    if (fillOnly) {
        addLog(platform, `[仅填充模式] 已填充: 第${chapterNum}章 ${chapterTitle}`);
        return { success: true, fillOnly: true };
    }

    await clickNextAndHandleGates(page, platform);
    await confirmPublishModal(page, platform);

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

async function fillContentToEditor(page, platform, content) {
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
}

async function verifyFanqiePublished(page, bookId, chapterNum, chapterTitle) {
    const chapterManageUrl = `https://fanqienovel.com/main/writer/chapter-manage/${bookId}`;
    await page.goto(chapterManageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

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

module.exports = {
    publishChapterToFanqie,
    verifyFanqiePublished
};
